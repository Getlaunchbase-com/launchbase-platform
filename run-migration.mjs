import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'generate', '--name', 'verticals'], {
  cwd: '/home/ubuntu/launchbase',
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
  console.log(data.toString());
  // Send enter when we see a prompt
  if (data.toString().includes('create column') || data.toString().includes('rename column')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 100);
  }
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});

// Safety timeout
setTimeout(() => {
  child.kill();
  process.exit(0);
}, 120000);
