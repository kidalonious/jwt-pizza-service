const os = require('os');

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function sendMetricsPeriodically(period) {
    const timer = setInterval(() => {
      try {
        const buf = new MetricBuilder();
        httpMetrics(buf);
        systemMetrics(buf);
        userMetrics(buf);
        purchaseMetrics(buf);
        authMetrics(buf);
  
        const metrics = buf.toString('\n');
        this.sendMetricToGrafana(metrics);
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }

  setInterval(() => {
    Object.keys(metrics.requests).forEach((key) => {
      sendMetricToGrafana('http_requests', metrics.requests[key], { method: key.split('_')[0], endpoint: key.split('_')[1] });
    });
  
    sendMetricToGrafana('auth_attempts_success', metrics.authAttempts.success, {});
    sendMetricToGrafana('auth_attempts_failed', metrics.authAttempts.failed, {});
    sendMetricToGrafana('pizza_orders_total', metrics.pizzaOrders.total, {});
    sendMetricToGrafana('pizza_orders_failed', metrics.pizzaOrders.failed, {});
    sendMetricToGrafana('revenue', metrics.revenue, {});
  
    Object.keys(metrics.latency).forEach((key) => {
      const avgLatency = metrics.latency[key].reduce((a, b) => a + b, 0) / metrics.latency[key].length;
      sendMetricToGrafana('request_latency', avgLatency, { method: key.split('_')[0], endpoint: key.split('_')[1] });
    });

    metrics.system.cpuUsage = getCpuUsagePercentage();
    metrics.system.memoryUsage = getMemoryUsagePercentage();
  
    sendMetricToGrafana('cpu_usage', metrics.system.cpuUsage, {});
    sendMetricToGrafana('memory_usage', metrics.system.memoryUsage, {});
  
  }, 10000);

function sendMetricToGrafana(metricName, metricValue, attributes) {
attributes = { ...attributes, source: config.metrics.source };

const metric = {
    resourceMetrics: [
    {
        scopeMetrics: [
        {
            metrics: [
            {
                name: metricName,
                unit: '1',
                sum: {
                dataPoints: [
                    {
                    asInt: metricValue,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [],
                    },
                ],
                aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                isMonotonic: true,
                },
            },
            ],
        },
        ],
    },
    ],
};

Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push({
    key: key,
    value: { stringValue: attributes[key] },
    });
});

fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
})
    .then((response) => {
    if (!response.ok) {
        console.error('Failed to push metrics data to Grafana');
    } else {
        console.log(`Pushed ${metricName}`);
    }
    })
    .catch((error) => {
    console.error('Error pushing metrics:', error);
    });
}
  