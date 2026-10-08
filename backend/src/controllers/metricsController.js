const Server = require('../models/Server');
const { getServerMetrics: queryPrometheus } = require('../services/prometheusService');
const { generateTimeSeriesMetrics } = require('../services/metricService');

// Simulated charts are only allowed outside production, and are always labelled as such.
const simulationAllowed = () =>
  process.env.METRICS_SIMULATION_FALLBACK
    ? process.env.METRICS_SIMULATION_FALLBACK === 'true'
    : process.env.NODE_ENV !== 'production';

// @desc    Get historical time-series metrics for a server
// @route   GET /api/servers/:id/metrics
// @access  Private
const getServerMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeRange = '1h' } = req.query;

    const server = await Server.findById(id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const serverInfo = {
      id: server._id,
      name: server.name,
      status: server.status,
      lastHeartbeat: server.agent?.lastHeartbeat,
      isLiveAgent: server.agent?.isLiveAgent || false,
    };

    let prom = null;
    let promError = null;
    try {
      prom = await queryPrometheus(server._id, timeRange);
    } catch (err) {
      promError = err.name === 'TimeoutError' || err.cause ? 'Prometheus unreachable' : err.message;
    }

    if (prom?.hasData) {
      return res.json({
        success: true,
        data: {
          timeRange,
          source: 'prometheus',
          lastSampleAt: prom.lastSampleAt,
          isStale: prom.isStale,
          server: serverInfo,
          currentSummary: {
            ...prom.current,
            agentVersion: server.agent?.version,
            heartbeat: server.agent?.status,
            isLiveAgent: serverInfo.isLiveAgent,
          },
          series: prom.series,
        },
      });
    }

    if (simulationAllowed()) {
      return res.json({
        success: true,
        data: {
          ...generateTimeSeriesMetrics(server, timeRange),
          source: 'simulated',
          sourceReason: promError || 'No samples in Prometheus for this server yet',
        },
      });
    }

    res.json({
      success: true,
      data: {
        timeRange,
        source: 'none',
        sourceReason: promError || 'No samples in Prometheus for this server yet',
        lastSampleAt: null,
        isStale: true,
        server: serverInfo,
        currentSummary: null,
        series: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getServerMetrics };
