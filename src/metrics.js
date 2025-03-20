const os = require('os');
const config = require('./config');

// Implement class to increment request values, create instance of the class and export the class

class MetricTracker {
    constructor() {
        this.httpRequests = { GET: 0, PUT: 0, POST: 0, DELETE: 0 };
        this.totalRequests = 0;
        this.activeUsers = 0;
        this.authAttempts = { successful: 0, failed: 0 };
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.latency = { serviceEndpoint: 0, pizzaCreation: 0 };
        // This will periodically send metrics to Grafana
        this.timer = setInterval(() => this.sendAllMetricsToGrafana(), 10000);
    }

    incrementHttpRequest(method) {
        if (this.httpRequests.hasOwnProperty(method)) {
            this.httpRequests[method]++;
            this.totalRequests++;
        }
    }

    incrementActiveUsers(count) {
        this.activeUsers += count;
    }

    incrementAuthAttempt(successful) {
        if (successful) {
            this.authAttempts.successful++;
        } else {
            this.authAttempts.failed++;
        }
    }

    setCpuUsage(percentage) {
        this.cpuUsage = this.getCpuUsagePercentage();
    }

    setMemoryUsage(percentage) {
        this.memoryUsage = this.getMemoryUsagePercentage();
    }

    setLatency(endpoint, value) {
        if (this.latency.hasOwnProperty(endpoint)) {
            this.latency[endpoint] = value;
        }
    }

    getMetrics() {
        return {
            httpRequests: this.httpRequests,
            totalRequests: this.totalRequests,
            activeUsers: this.activeUsers,
            authAttempts: this.authAttempts,
            cpuUsage: this.cpuUsage,
            memoryUsage: this.memoryUsage,
            latency: this.latency,
        };
    }

    resetMetrics() {
        this.httpRequests = { GET: 0, PUT: 0, POST: 0, DELETE: 0 };
        this.totalRequests = 0;
        this.activeUsers = 0;
        this.authAttempts = { successful: 0, failed: 0 };
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.latency = { serviceEndpoint: 0, pizzaCreation: 0 };
    }


    getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
    }

    getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
    }

    sendMetricToGrafana(metricName, metricValue, attributes = {}) {
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
    }
}

const metricMaker = new MetricTracker();

module.exports = { metricMaker };