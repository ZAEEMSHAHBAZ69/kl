
const { execSync } = require('child_process');

try {
    console.log('Attempting to pull to get repair commands...');
    let output = '';
    try {
        execSync('pnpm exec supabase db pull', { stdio: 'pipe' });
    } catch (error) {
        output = error.stdout.toString() + error.stderr.toString();
    }

    const lines = output.split('\n');
    const repairCommands = lines.filter(line => line.trim().startsWith('supabase migration repair'));

    if (repairCommands.length === 0) {
        console.log('No repair commands found. Checking if db pull succeeded...');
        if (output.includes('Success')) {
            console.log('DB Pull succeeded!');
        } else {
            console.log('DB Pull failed but no repair commands suggested. Output:', output);
        }
    } else {
        console.log(`Found ${repairCommands.length} repair commands. Batching...`);

        // Extract versions
        const versions = repairCommands.map(cmd => {
            const parts = cmd.trim().split(' ');
            return parts[parts.length - 1]; // The version is the last argument
        });

        // Construct single command
        // Note: Windows command line length limit is 8191 chars. 289 versions * ~15 chars = ~4300 chars. Should be safe.
        const versionString = versions.join(' ');
        const fullCmd = `pnpm exec supabase migration repair --status reverted ${versionString}`;

        console.log(`Running batched repair command...`);
        try {
            execSync(fullCmd, { stdio: 'inherit' });
            console.log('Repair complete.');
        } catch (e) {
            console.error(`Failed to run repair:`, e.message);
            process.exit(1);
        }
    }

    console.log('Attempting db pull again...');
    execSync('pnpm exec supabase db pull', { stdio: 'inherit' });

    console.log('Pull complete. Attempting db push...');
    execSync('pnpm exec supabase db push', { stdio: 'inherit' });

} catch (err) {
    console.error('Script failed:', err);
}
