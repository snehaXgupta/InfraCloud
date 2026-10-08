// Monthly list prices (USD) used for resize planning and cost estimates. Verify against the
// provider's current pricing; Billing can override any server's rate on the Costs page.
const PROVIDER_SIZES = {
  Vultr: [
    { type: 'vc2-1c-1gb', vcpu: 1, ramGb: 1, diskGb: 25, priceMonthly: 5, family: 'Cloud Compute' },
    { type: 'vc2-1c-2gb', vcpu: 1, ramGb: 2, diskGb: 55, priceMonthly: 10, family: 'Cloud Compute' },
    { type: 'vc2-2c-2gb', vcpu: 2, ramGb: 2, diskGb: 65, priceMonthly: 15, family: 'Cloud Compute' },
    { type: 'vc2-2c-4gb', vcpu: 2, ramGb: 4, diskGb: 80, priceMonthly: 20, family: 'Cloud Compute' },
    { type: 'vc2-4c-8gb', vcpu: 4, ramGb: 8, diskGb: 160, priceMonthly: 40, family: 'Cloud Compute' },
    { type: 'vc2-6c-16gb', vcpu: 6, ramGb: 16, diskGb: 320, priceMonthly: 80, family: 'Cloud Compute' },
    { type: 'vc2-8c-32gb', vcpu: 8, ramGb: 32, diskGb: 640, priceMonthly: 160, family: 'Cloud Compute' },
    { type: 'vc2-16c-64gb', vcpu: 16, ramGb: 64, diskGb: 1280, priceMonthly: 320, family: 'Cloud Compute' },
  ],
  DigitalOcean: [
    { type: 's-1vcpu-1gb', vcpu: 1, ramGb: 1, diskGb: 25, priceMonthly: 6, transferTb: 1, family: 'Basic' },
    { type: 's-1vcpu-2gb', vcpu: 1, ramGb: 2, diskGb: 50, priceMonthly: 12, transferTb: 2, family: 'Basic' },
    { type: 's-2vcpu-2gb', vcpu: 2, ramGb: 2, diskGb: 60, priceMonthly: 18, transferTb: 3, family: 'Basic' },
    { type: 's-2vcpu-4gb', vcpu: 2, ramGb: 4, diskGb: 80, priceMonthly: 24, transferTb: 4, family: 'Basic' },
    { type: 's-4vcpu-8gb', vcpu: 4, ramGb: 8, diskGb: 160, priceMonthly: 48, transferTb: 5, family: 'General Purpose' },
    { type: 's-8vcpu-16gb', vcpu: 8, ramGb: 16, diskGb: 320, priceMonthly: 96, transferTb: 6, family: 'General Purpose' },
    { type: 's-16vcpu-32gb', vcpu: 16, ramGb: 32, diskGb: 640, priceMonthly: 192, transferTb: 8, family: 'High Memory' },
    { type: 'c-8vcpu-16gb', vcpu: 8, ramGb: 16, diskGb: 100, priceMonthly: 84, transferTb: 5, family: 'CPU-Optimized' },
  ],
  AWS: [
    { type: 't3.micro', vcpu: 2, ramGb: 1, diskGb: 30, priceMonthly: 7.5, family: 'General Purpose' },
    { type: 't3.small', vcpu: 2, ramGb: 2, diskGb: 40, priceMonthly: 15.0, family: 'General Purpose' },
    { type: 't3.medium', vcpu: 2, ramGb: 4, diskGb: 60, priceMonthly: 30.0, family: 'General Purpose' },
    { type: 'c6i.large', vcpu: 2, ramGb: 4, diskGb: 100, priceMonthly: 62.0, family: 'Compute Optimized' },
    { type: 'c6i.xlarge', vcpu: 4, ramGb: 8, diskGb: 200, priceMonthly: 124.0, family: 'Compute Optimized' },
    { type: 'c6i.2xlarge', vcpu: 8, ramGb: 16, diskGb: 400, priceMonthly: 248.0, family: 'Compute Optimized' },
    { type: 'r6i.xlarge', vcpu: 4, ramGb: 32, diskGb: 300, priceMonthly: 184.0, family: 'Memory Optimized' },
    { type: 'r6i.2xlarge', vcpu: 8, ramGb: 64, diskGb: 600, priceMonthly: 368.0, family: 'Memory Optimized' },
  ],
  GCP: [
    { type: 'e2-micro', vcpu: 2, ramGb: 1, diskGb: 20, priceMonthly: 7.1, family: 'Cost-Effective' },
    { type: 'e2-small', vcpu: 2, ramGb: 2, diskGb: 40, priceMonthly: 14.2, family: 'General Purpose' },
    { type: 'e2-medium', vcpu: 2, ramGb: 4, diskGb: 80, priceMonthly: 28.4, family: 'General Purpose' },
    { type: 'e2-standard-4', vcpu: 4, ramGb: 16, diskGb: 150, priceMonthly: 96.0, family: 'General Purpose' },
    { type: 'n2-standard-8', vcpu: 8, ramGb: 32, diskGb: 300, priceMonthly: 198.0, family: 'High Performance' },
    { type: 'n2-highcpu-16', vcpu: 16, ramGb: 32, diskGb: 500, priceMonthly: 340.0, family: 'Compute Optimized' },
  ],
  Hetzner: [
    { type: 'CX22', vcpu: 2, ramGb: 4, diskGb: 40, priceMonthly: 4.5, family: 'Shared CPU' },
    { type: 'CX32', vcpu: 4, ramGb: 8, diskGb: 80, priceMonthly: 9.0, family: 'Shared CPU' },
    { type: 'CPX41', vcpu: 8, ramGb: 16, diskGb: 160, priceMonthly: 28.0, family: 'High Performance' },
    { type: 'CPX51', vcpu: 16, ramGb: 32, diskGb: 360, priceMonthly: 62.0, family: 'High Performance' },
    { type: 'CCX33', vcpu: 8, ramGb: 32, diskGb: 240, priceMonthly: 75.0, family: 'Dedicated CPU' },
  ],
  Azure: [
    { type: 'Standard_B1s', vcpu: 1, ramGb: 1, diskGb: 30, priceMonthly: 7.6, family: 'Burstable' },
    { type: 'Standard_B2s', vcpu: 2, ramGb: 4, diskGb: 60, priceMonthly: 30.5, family: 'Burstable' },
    { type: 'Standard_D2s_v5', vcpu: 2, ramGb: 8, diskGb: 100, priceMonthly: 70.0, family: 'General Purpose' },
    { type: 'Standard_D4s_v5', vcpu: 4, ramGb: 16, diskGb: 200, priceMonthly: 140.0, family: 'General Purpose' },
    { type: 'Standard_D8s_v5', vcpu: 8, ramGb: 32, diskGb: 400, priceMonthly: 280.0, family: 'General Purpose' },
  ],
  'On-Premise': [
    { type: 'vm.small', vcpu: 2, ramGb: 4, diskGb: 50, priceMonthly: 0, family: 'Virtual Machine' },
    { type: 'vm.medium', vcpu: 4, ramGb: 8, diskGb: 100, priceMonthly: 0, family: 'Virtual Machine' },
    { type: 'vm.large', vcpu: 8, ramGb: 16, diskGb: 250, priceMonthly: 0, family: 'Virtual Machine' },
    { type: 'vm.xlarge', vcpu: 16, ramGb: 32, diskGb: 500, priceMonthly: 0, family: 'Virtual Machine' },
  ],
};

module.exports = { PROVIDER_SIZES };
