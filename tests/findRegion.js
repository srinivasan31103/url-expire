const { Client } = require('pg');

const regions = [
    'ap-south-1',     // Mumbai
    'ap-southeast-1', // Singapore
    'us-east-1',      // N. Virginia
    'us-east-2',      // Ohio
    'us-west-1',      // N. California
    'us-west-2',      // Oregon
    'eu-central-1',   // Frankfurt
    'eu-west-1',      // Ireland
    'sa-east-1',      // São Paulo
    'ca-central-1',   // Canada Central
    'ap-northeast-1', // Tokyo
    'ap-northeast-2', // Seoul
    'ap-southeast-2'  // Sydney
];

const password = 'Srinivasan@3110';
const projectRef = 'hnzdpwqpbocjamxuiuhr';

async function testConnection(region) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${host}:5432/postgres`;
    
    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return true;
    } catch (err) {
        console.log(`Failed for ${region}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log("Probing regional database poolers...");
    for (const region of regions) {
        console.log(`Checking region: ${region}...`);
        const ok = await testConnection(region);
        if (ok) {
            console.log(`\n🎉 SUCCESS! Connected to region: ${region}`);
            console.log(`Pooled Connection Host: aws-0-${region}.pooler.supabase.com`);
            console.log(`Recommended DATABASE_URL:`);
            console.log(`postgresql://postgres.${projectRef}:Srinivasan%403110@aws-0-${region}.pooler.supabase.com:5432/postgres?sslmode=require`);
            process.exit(0);
        }
    }
    console.log("\n❌ Failed to connect to any pooler region. Please check credentials or network.");
    process.exit(1);
}

main();
