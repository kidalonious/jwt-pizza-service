const os = require('os');
const fetch = require('node-fetch');
const config = require('./config');

class MetricTracker {
    constructor() {
        this.httpRequests = { 'GET': 0, 'PUT': 0, 'POST': 0, 'DELETE': 0 };
        this.totalRequests = 0;
        this.activeUsers = 0;
        this.authAttempts = { 'successful': 0, 'failed': 0 };
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.latency = { 'serviceEndpoint': 0, 'pizzaCreation': 0 };
        this.timer = setInterval(() => this.sendAllMetricsToGrafana(), 60000);
        this.pizzaSales = 0;
        this.pizzaRevenue = 0;
        this.pizzaFailures = 0;
    }

    incrementHttpRequest(method) {
            this.httpRequests[method]++;
            this.totalRequests++;
    }

    incrementActiveUsers(count) {
        this.activeUsers += count;
    }

    decrementActiveUsers(count) {
        this.activeUsers = Math.max(0, this.activeUsers - count);
    }

    incrementAuthAttempt(successful) {
        if (successful) {
            this.authAttempts['successful']++;
        } else {
            this.authAttempts['failed']++;
        }
    }

    incrementPizzaSales() {
        this.pizzaSales += 1;
    }

    incrementPizzaFailures() {
        this.pizzaFailures += 1;
    }

    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return (cpuUsage * 100).toFixed(2);
    }

    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        return ((usedMemory / totalMemory) * 100).toFixed(2);
    }

    setLatency(endpoint, value) {
        this.latency[endpoint] = value;
    }

    getMetrics() {
        return {
            httpRequests: { ...this.httpRequests },
            totalRequests: this.totalRequests,
            activeUsers: this.activeUsers,
            authAttempts: { ...this.authAttempts },
            cpuUsage: this.getCpuUsagePercentage(),
            memoryUsage: this.getMemoryUsagePercentage(),
            latency: { ...this.latency },
            pizzaSales: this.pizzaSales,
            // pizzaRevenue: parseFloat(this.pizzaRevenue.toFixed(6))
        };
    }

    sendMetricToGrafana(metricName, metricValue, attributes) {
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
          } 
        })
        .catch((error) => {
          console.error('Error pushing metrics:', error);
        });
    }

    sendAllMetricsToGrafana() {
        const metrics = this.getMetrics();
        for (const [metricName, metricValue] of Object.entries(metrics)) {
            if (typeof metricValue === 'object') {
                for (const [subMetricName, subMetricValue] of Object.entries(metricValue)) {
                    this.sendMetricToGrafana(`${metricName}.${subMetricName}`, subMetricValue);
                }
            } else {
                this.sendMetricToGrafana(metricName, metricValue);
            }
        }
        this.clearHttpRequests();
    }

    trackHttpRequest(method) {
        return (_req, _res, next) => {
            this.incrementHttpRequest(method);
            next();
        };
    }

    trackAuthAttempt(success) {
        return (_req, _res, next) => {
            this.incrementAuthAttempt(success);
            next();
        };
    }

    trackActiveUsers(increment = true) {
        return (_req, _res, next) => {
            if (increment) {
                this.incrementActiveUsers(1);
            }
            next();
        };
    }

    trackPizzaSales(successful) {
        return (_req, _res, next) => {
            if (successful) {
                this.incrementPizzaSales();
            }
            else {
                this.incrementPizzaFailures();
            }
            next();
        }
    }

    clearHttpRequests() {
        this.totalRequests = 0;
        this.httpRequests['GET'] = 0;
        this.httpRequests['DELETE'] = 0;
        this.httpRequests['POST'] = 0;
        this.httpRequests['PUT'] = 0;
    }
}

const metricMaker = new MetricTracker()

module.exports = metricMaker;