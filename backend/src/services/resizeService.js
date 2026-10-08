/**
 * Provider-Aware Resize & Capacity Engine
 * Handles instance type catalogs, headroom recommendations, downtime requirements,
 * pre-resize snapshot checks, two-person production approvals, and health validation.
 */

const { PROVIDER_SIZES } = require('./priceList');

/**
 * Get provider-specific downtime requirement details
 */
const getDowntimeRequirements = (provider, isDiskResizeOnly = false) => {
  if (isDiskResizeOnly) {
    return {
      downtimeExpected: 'Zero Downtime',
      durationMinutes: 0,
      description: 'Online disk volume expansion supported without stopping OS instance.',
      requiresStop: false,
    };
  }

  switch (provider) {
    case 'AWS':
      return {
        downtimeExpected: '~2 to 3 minutes',
        durationMinutes: 3,
        description: 'AWS EC2 requires stopping instance to modify instance-type attribute, then cold restarting.',
        requiresStop: true,
        rebootPolicy: 'Instance will be gracefully stopped and restarted.',
        incompatibilityNotice: 'Incompatible architectures (e.g. x86_64 to ARM Graviton) require AMI migration rather than in-place resize.',
      };
    case 'DigitalOcean':
      return {
        downtimeExpected: '~1 to 2 minutes',
        durationMinutes: 2,
        description: 'DigitalOcean droplet will be powered down, hypervisor allocation updated, and booted.',
        requiresStop: true,
        rebootPolicy: 'Droplet power cycle required for CPU and RAM allocation changes.',
        incompatibilityNotice: 'Disk resizing is permanent and cannot be downscaled later.',
      };
    case 'GCP':
      return {
        downtimeExpected: '~2 to 3 minutes',
        durationMinutes: 3,
        description: 'GCP Compute Engine requires STOP command before updating machine-type.',
        requiresStop: true,
        rebootPolicy: 'VM will be stopped and restarted with updated core scheduling.',
      };
    case 'Hetzner':
      return {
        downtimeExpected: '~1 minute',
        durationMinutes: 1,
        description: 'Hetzner Cloud server shutdown and automatic rebuild of cloud flavor.',
        requiresStop: true,
        rebootPolicy: 'Graceful shutdown and reboot.',
      };
    default:
      return {
        downtimeExpected: '~1 to 2 minutes',
        durationMinutes: 2,
        description: 'Hypervisor core reconfiguration with planned guest OS reboot.',
        requiresStop: true,
        rebootPolicy: 'Guest OS restart required.',
      };
  }
};

/**
 * Pick a recommended plan from real utilisation (7-day p95):
 *  - upgrade when p95 CPU > 80% or p95 memory > 85%: smallest plan giving ~60% CPU / ~70% memory
 *  - downscale when both p95 < 30% and the provider allows downgrades
 */
const recommend = (utilization, current, candidates, supportsDowngrade) => {
  if (!utilization) {
    return { action: 'No data', message: 'No usage history yet — connect the agent to get a recommendation.' };
  }
  const { p95Cpu = 0, p95Memory = 0 } = utilization;
  const needVcpu = Math.ceil(((current.vcpu || 1) * p95Cpu) / 60);
  const needRam = ((current.ramGb || 1) * p95Memory) / 70;
  const byPrice = [...candidates].sort((a, b) => a.priceMonthly - b.priceMonthly);

  if (p95Cpu > 80 || p95Memory > 85) {
    const fit = byPrice.find((p) => p.vcpu >= needVcpu && p.ramGb >= needRam && p.priceMonthly > (current.priceMonthly || 0));
    return {
      action: 'Upgrade recommended',
      message: `Peak usage is high (p95 CPU ${p95Cpu}%, memory ${p95Memory}%).`,
      planType: fit?.type || null,
    };
  }
  if (supportsDowngrade && p95Cpu < 30 && p95Memory < 30) {
    const fit = byPrice.find((p) => p.vcpu >= Math.max(1, needVcpu) && p.ramGb >= needRam && p.priceMonthly < (current.priceMonthly || 0));
    if (fit) {
      return {
        action: 'Downscale possible',
        message: `Server is mostly idle (p95 CPU ${p95Cpu}%, memory ${p95Memory}%).`,
        planType: fit.type,
      };
    }
  }
  return { action: 'Right-sized', message: `Peak usage is within healthy limits (p95 CPU ${p95Cpu}%, memory ${p95Memory}%).` };
};

module.exports = {
  PROVIDER_SIZES,
  getDowntimeRequirements,
  recommend,
};
