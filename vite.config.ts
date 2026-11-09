import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
        execFile('python3', ['train.py'], (err, stdout, stderr) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            exitCode: err ? 1 : 0,
            stdout,
            stderr,
          }));
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

