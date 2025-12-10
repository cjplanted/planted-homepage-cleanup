import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Globe, Server, Shield } from 'lucide-react';

interface HealthCheck {
  status: 'ok' | 'error';
  message: string;
  latencyMs?: number;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  region: string;
  version: string;
  latencyMs: number;
  checks: Record<string, HealthCheck>;
  endpoints: Array<{ path: string; auth: boolean; description: string }>;
  authInfo: { note: string; tokenHeader: string };
}

interface TestResult {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'error';
  message: string;
  latencyMs?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://europe-west6-get-planted-db.cloudfunctions.net';

/**
 * Test Page - No Authentication Required
 *
 * This page allows testing the API and auth system without logging in.
 * Useful for debugging deployment issues.
 */
export function TestPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTests = useCallback(async () => {
    setLoading(true);
    const results: TestResult[] = [];

    // Test 1: Health check endpoint
    const healthTest: TestResult = {
      name: 'Health Check API',
      status: 'pending',
      message: 'Testing...',
    };
    results.push(healthTest);
    setTests([...results]);

    const healthStart = Date.now();
    try {
      const response = await fetch(`${API_BASE_URL}/adminHealthCheck`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const latency = Date.now() - healthStart;

      if (response.ok) {
        const data: HealthCheckResponse = await response.json();
        setHealthData(data);
        healthTest.status = 'pass';
        healthTest.message = `API responded in ${latency}ms (status: ${data.status})`;
        healthTest.latencyMs = latency;
      } else {
        healthTest.status = 'fail';
        healthTest.message = `HTTP ${response.status}: ${response.statusText}`;
        healthTest.latencyMs = latency;
      }
    } catch (error) {
      healthTest.status = 'error';
      healthTest.message = `Network error: ${(error as Error).message}`;
      healthTest.latencyMs = Date.now() - healthStart;
    }
    results[0] = healthTest;
    setTests([...results]);

    // Test 2: CORS Preflight
    const corsTest: TestResult = {
      name: 'CORS Preflight (OPTIONS)',
      status: 'pending',
      message: 'Testing...',
    };
    results.push(corsTest);
    setTests([...results]);

    const corsStart = Date.now();
    try {
      const response = await fetch(`${API_BASE_URL}/adminHealthCheck`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
        },
      });
      const latency = Date.now() - corsStart;
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');

      if (response.status === 204 || response.status === 200) {
        corsTest.status = 'pass';
        corsTest.message = `Preflight OK (${latency}ms), CORS: ${corsHeader || 'header present'}`;
        corsTest.latencyMs = latency;
      } else {
        corsTest.status = 'fail';
        corsTest.message = `Unexpected status: ${response.status}`;
        corsTest.latencyMs = latency;
      }
    } catch (error) {
      corsTest.status = 'error';
      corsTest.message = `Network error: ${(error as Error).message}`;
      corsTest.latencyMs = Date.now() - corsStart;
    }
    results[1] = corsTest;
    setTests([...results]);

    // Test 3: Auth endpoint (should return 401 without token)
    const authTest: TestResult = {
      name: 'Auth Protected Endpoint',
      status: 'pending',
      message: 'Testing...',
    };
    results.push(authTest);
    setTests([...results]);

    const authStart = Date.now();
    try {
      const response = await fetch(`${API_BASE_URL}/adminReviewQueue`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin,
        },
      });
      const latency = Date.now() - authStart;
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');

      if (response.status === 401) {
        authTest.status = 'pass';
        authTest.message = `Correctly returned 401 (${latency}ms), CORS headers: ${corsHeader ? 'present' : 'missing'}`;
        authTest.latencyMs = latency;
      } else if (response.status === 200) {
        authTest.status = 'fail';
        authTest.message = 'Returned 200 - auth may not be working!';
        authTest.latencyMs = latency;
      } else {
        authTest.status = 'fail';
        authTest.message = `Unexpected status: ${response.status}`;
        authTest.latencyMs = latency;
      }
    } catch (error) {
      // CORS errors often throw, but that means the request was made
      authTest.status = 'error';
      authTest.message = `Error (may be CORS): ${(error as Error).message}`;
      authTest.latencyMs = Date.now() - authStart;
    }
    results[2] = authTest;
    setTests([...results]);

    // Test 4: Firebase Config
    const configTest: TestResult = {
      name: 'Firebase Config',
      status: 'pending',
      message: 'Checking...',
    };
    results.push(configTest);
    setTests([...results]);

    const requiredEnvVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
    ];
    const missingVars = requiredEnvVars.filter(
      (v) => !import.meta.env[v]
    );

    if (missingVars.length === 0) {
      configTest.status = 'pass';
      configTest.message = `All required env vars present (${requiredEnvVars.length}/${requiredEnvVars.length})`;
    } else {
      configTest.status = 'fail';
      configTest.message = `Missing: ${missingVars.join(', ')}`;
    }
    results[3] = configTest;
    setTests([...results]);

    setLoading(false);
    setLastRun(new Date());
  }, []);

  useEffect(() => {
    runTests();
  }, [runTests]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400 animate-spin" />;
    }
  };

  const getOverallStatus = () => {
    if (tests.length === 0 || tests.some((t) => t.status === 'pending')) {
      return { text: 'Running...', color: 'text-gray-500', bg: 'bg-gray-100' };
    }
    const failures = tests.filter((t) => t.status === 'fail' || t.status === 'error').length;
    if (failures === 0) {
      return { text: 'All Tests Passed', color: 'text-green-600', bg: 'bg-green-100' };
    }
    if (failures < tests.length) {
      return { text: `${failures} Test${failures > 1 ? 's' : ''} Failed`, color: 'text-yellow-600', bg: 'bg-yellow-100' };
    }
    return { text: 'All Tests Failed', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Health Check</h1>
            <p className="text-gray-600">Test API connectivity and system status (no login required)</p>
          </div>
          <Button
            onClick={runTests}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running...' : 'Run Tests'}
          </Button>
        </div>

        {/* Overall Status */}
        <Card>
          <CardContent className="pt-6">
            <div className={`p-4 rounded-lg ${overallStatus.bg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-lg font-semibold ${overallStatus.color}`}>
                  {overallStatus.text}
                </span>
                {lastRun && (
                  <span className="text-sm text-gray-500">
                    Last run: {lastRun.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Connectivity Tests
            </CardTitle>
            <CardDescription>
              Testing API endpoints and CORS configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tests.map((test, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {getStatusIcon(test.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{test.name}</div>
                    <div className="text-sm text-gray-600 break-words">
                      {test.message}
                    </div>
                  </div>
                  {test.latencyMs !== undefined && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {test.latencyMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Health Check Details */}
        {healthData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                API Health Details
              </CardTitle>
              <CardDescription>
                Detailed health check from {healthData.region}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">Status</div>
                  <div className={`text-lg font-semibold ${
                    healthData.status === 'healthy' ? 'text-green-600' :
                    healthData.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {healthData.status}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">Latency</div>
                  <div className="text-lg font-semibold">{healthData.latencyMs}ms</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">Region</div>
                  <div className="text-lg font-semibold">{healthData.region}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">Version</div>
                  <div className="text-lg font-semibold">{healthData.version}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">System Checks</h4>
                {Object.entries(healthData.checks).map(([key, check]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-sm"
                  >
                    {check.status === 'ok' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{key}:</span>
                    <span className="text-gray-600">{check.message}</span>
                    {check.latencyMs && (
                      <span className="text-gray-400">({check.latencyMs}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Endpoints */}
        {healthData?.endpoints && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Available Endpoints
              </CardTitle>
              <CardDescription>
                All admin API endpoints ({healthData.endpoints.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Endpoint</th>
                      <th className="text-left py-2 px-3">Auth</th>
                      <th className="text-left py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthData.endpoints.map((endpoint, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono text-xs">
                          {endpoint.path}
                        </td>
                        <td className="py-2 px-3">
                          {endpoint.auth ? (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                              Required
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Public
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {endpoint.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <a
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go to Dashboard
              </a>
              <a
                href={`${API_BASE_URL}/adminHealthCheck`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Raw Health Check JSON
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
