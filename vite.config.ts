import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { defineConfig, Plugin } from 'vite';

function promptGuardPythonPlugin(): Plugin {
  return {
    name: 'promptguard-python-api',
    configureServer(server) {
      server.middlewares.use('/api/py-scan', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const prompt = data.prompt || '';
              const policy = data.policy || 'standard';

              execFile('python3', ['cli.py', prompt, policy], { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message, stderr }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(stdout);
              });
            } catch (parseErr: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: parseErr.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      server.middlewares.use('/api/py-sanitize', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const prompt = data.prompt || '';
              execFile('python3', ['scripts/sanitize_api.py', prompt], { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message, stderr }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(stdout);
              });
            } catch (parseErr: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: parseErr.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      server.middlewares.use('/api/py-canary-inspect', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const outputText = data.output || '';
              const canary = data.canary || '';
              const sysPrompt = data.systemPrompt || '';
              execFile('python3', ['scripts/canary_api.py', outputText, canary, sysPrompt], { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message, stderr }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(stdout);
              });
            } catch (parseErr: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: parseErr.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });

      server.middlewares.use('/api/py-test', (req, res) => {
        execFile('python3', ['-m', 'unittest', 'discover', 'tests'], (err, stdout, stderr) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            exitCode: err ? 1 : 0,
            stdout,
            stderr,
          }));
        });
      });

      server.middlewares.use('/api/py-train', (req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let epochs = '25';
          let lr = '0.12';
          try {
            if (body) {
              const parsed = JSON.parse(body);
              if (parsed.epochs) epochs = String(parsed.epochs);
              if (parsed.learningRate || parsed.learning_rate) lr = String(parsed.learningRate || parsed.learning_rate);
              if (parsed.newSample && parsed.newSample.text) {
                const s = parsed.newSample;
                const pi = s.prompt_injection ? 1 : 0;
                const jb = s.jailbreak ? 1 : 0;
                const sd = s.sensitive_data ? 1 : 0;
                const mi = s.malicious_intent ? 1 : 0;
                const cleanText = `"${String(s.text).replace(/"/g, '""')}"`;
                const newRow = `\nPG-USER-${Date.now()},${cleanText},${pi},${jb},${sd},${mi},User Submission,user_custom,Custom sample added by user`;
                fs.appendFileSync('dataset/promptguard_dataset.csv', newRow, 'utf-8');
              }
            }
          } catch {}

          execFile('python3', ['train_multilabel.py', epochs, lr], { maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
            let modelData = null;
            try {
              if (fs.existsSync('models/promptguard_model.json')) {
                modelData = JSON.parse(fs.readFileSync('models/promptguard_model.json', 'utf-8'));
              }
            } catch {}

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              exitCode: err ? 1 : 0,
              stdout,
              stderr,
              model: modelData,
            }));
          });
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), promptGuardPythonPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

