import { createClient } from '@agent-switchboard/sdk';

async function main() {
  const client = createClient({
    baseUrl: 'http://localhost:5000',
    apiKey: process.env.AGENT_API_KEY || 'sk_agent_your_key_here',
  });

  console.log('Agent Switchboard SDK - Basic Example');
  console.log('======================================');
  console.log('');

  try {
    console.log('1. Requesting a filesystem read action...');
    const { requestId, dryRun } = await client.requestAndPreview({
      type: 'filesystem',
      operation: 'read',
      params: {
        path: './sandbox/example.txt',
      },
    });

    console.log(`   Request created: #${requestId}`);
    console.log(`   Plan ID: ${dryRun.planId}`);
    console.log(`   Risk Score: ${dryRun.riskScore}/100`);
    console.log(`   Steps: ${dryRun.steps.length}`);
    console.log('');

    console.log('2. Dry run preview:');
    for (const step of dryRun.steps) {
      console.log(`   - [${step.type}] ${step.description}`);
      if (step.riskFlags.length > 0) {
        console.log(`     Risk flags: ${step.riskFlags.join(', ')}`);
      }
    }
    console.log('');

    console.log('3. Waiting for admin approval...');
    console.log('   (Open http://localhost:5000 to approve the plan)');
    console.log('');

    console.log('4. Once approved, execute with:');
    console.log(`   const result = await client.execute(${dryRun.planId});`);
    console.log('');

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.log('');
    console.log('Make sure:');
    console.log('  1. Agent Switchboard server is running on localhost:5000');
    console.log('  2. You have a valid agent API key');
    console.log('  3. The agent has filesystem capability enabled');
  }
}

main();
