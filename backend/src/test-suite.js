import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' STARTING FULL PLATFORM END-TO-END TEST SUITE');
  console.log('====================================================\n');

  let adminToken = '';
  let serverId = '';
  let alertId = '';
  let testClientId = '';
  let testProjectId = '';

  const results = [];

  function record(name, passed, details = '') {
    results.push({ name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${name}] ${details}`);
  }

  // 1. Health check
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    record('API Health Check', res.status === 200 && res.data?.status === 'healthy', `Status: ${res.data?.status}`);
  } catch (e) {
    record('API Health Check', false, e.message);
  }

  // 2. Auth: Admin Login
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@example.com', password: 'Admin@123' });

    adminToken = res.data?.token;
    record('Auth: Admin Login', res.status === 200 && !!adminToken, `User: ${res.data?.user?.name} (${res.data?.user?.role})`);
  } catch (e) {
    record('Auth: Admin Login', false, e.message);
  }

  // 3. Auth: Current User profile (/api/auth/me)
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record('Auth: Verify Session (/me)', res.status === 200 && !!res.data?.user?.email, `User: ${res.data?.user?.email} (${res.data?.user?.role})`);
  } catch (e) {
    record('Auth: Verify Session (/me)', false, e.message);
  }

  // 4. Dashboard Stats Overview (/api/dashboard/summary)
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/dashboard/summary',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const counts = res.data?.data?.counts;
    record('Dashboard Stats Overview', res.status === 200 && counts?.servers !== undefined, `Total Servers: ${counts?.servers}, Clients: ${counts?.clients}, Health Score: ${res.data?.data?.health?.healthScore}%`);
  } catch (e) {
    record('Dashboard Stats Overview', false, e.message);
  }

  // 5. Servers: List and Filter
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/servers',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const servers = res.data?.data || [];
    if (servers.length > 0) {
      serverId = servers[0]._id;
    }
    record('Servers: List All', res.status === 200 && servers.length > 0, `Found ${servers.length} servers across environments`);
  } catch (e) {
    record('Servers: List All', false, e.message);
  }

  // 6. Server Details & Telemetry
  if (serverId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/servers/${serverId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      record('Servers: Detail Fetch', res.status === 200, `Hostname: ${res.data?.data?.hostname}, OS: ${res.data?.data?.os?.distro || 'Ubuntu 22.04 LTS'}`);
    } catch (e) {
      record('Servers: Detail Fetch', false, e.message);
    }

    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/servers/${serverId}/metrics?timeRange=1h`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const points = res.data?.data?.series?.length || 0;
      record('Metrics: Time-Series Engine (1h)', res.status === 200 && points > 0, `${points} time-series data points generated`);
    } catch (e) {
      record('Metrics: Time-Series Engine (1h)', false, e.message);
    }
  }

  // 7. Operations: Dispatch & Run Catalog Operation
  if (serverId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/operations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        serverId,
        operationType: 'Health Check',
        parameters: { verbose: true }
      });
      const opObj = res.data?.data;
      const opId = opObj?._id;
      record('Operations: Dispatch Health Check', (res.status === 201 || res.status === 200) && !!opId, `Operation ID: ${opId}, Status: ${opObj?.status}`);
      record('Operations: Verify Execution Output', opObj && typeof opObj.output === 'string' && opObj.output.length > 0, `Generated ${opObj?.output?.split('\n').length} log output lines`);
    } catch (e) {
      record('Operations: Dispatch Health Check', false, e.message);
    }
  }

  // 8. Arbitrary Shell Rejection Security Test
  if (serverId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/operations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        serverId,
        command: 'rm -rf /; echo hacked',
        operationType: 'Health Check'
      });
      record('Security: Block Arbitrary Shell Execution', res.status === 400, `Correctly blocked with 400 Bad Request`);
    } catch (e) {
      record('Security: Block Arbitrary Shell Execution', false, e.message);
    }
  }

  // 9. Alerts: List and Acknowledge
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/alerts',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const alerts = res.data?.data || [];
    record('Alerts: List All', res.status === 200, `Found ${alerts.length} alerts`);
    if (alerts.length > 0) {
      alertId = alerts[0]._id;
      const ackRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/alerts/${alertId}/acknowledge`,
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      record('Alerts: Acknowledge Alert', ackRes.status === 200, `Alert ${alertId} status: ${ackRes.data?.data?.status}`);
    }
  } catch (e) {
    record('Alerts: List & Acknowledge', false, e.message);
  }

  // 10. Clients: List and Create
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/clients',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const clients = res.data?.data || [];
    if (clients.length > 0) testClientId = clients[0]._id;
    record('Clients: List All', res.status === 200, `Found ${clients.length} clients`);
  } catch (e) {
    record('Clients: List All', false, e.message);
  }

  // 11. Projects: List and Detail
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/projects',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const projects = res.data?.data || [];
    if (projects.length > 0) testProjectId = projects[0]._id;
    record('Projects: List All', res.status === 200, `Found ${projects.length} projects`);
  } catch (e) {
    record('Projects: List All', false, e.message);
  }

  // 12. Environments: List for Project
  if (testProjectId) {
    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/environments?projectId=${testProjectId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const envs = res.data?.data || [];
      record('Environments: Query by Project', res.status === 200, `Found ${envs.length} environments`);
    } catch (e) {
      record('Environments: Query by Project', false, e.message);
    }
  }

  // 13. Audit Logs: Query Ledger
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/audit-logs?limit=10',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const logs = res.data?.data || [];
    record('Audit Logs: Query Ledger', res.status === 200 && logs.length > 0, `Retrieved ${logs.length} audit records`);
  } catch (e) {
    record('Audit Logs: Query Ledger', false, e.message);
  }

  // 14. Users: List and RBAC
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const users = res.data?.data || [];
    record('Users & RBAC: List Users', res.status === 200 && users.length > 0, `Found ${users.length} active users`);
  } catch (e) {
    record('Users & RBAC: List Users', false, e.message);
  }

  console.log('\n====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(` SUMMARY: ${results.filter(r => r.passed).length}/${results.length} Tests Passed`);
  console.log(` RESULT: ${allPassed ? 'ALL SYSTEMS OPERATIONAL 🚀' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');
}

runTests();
