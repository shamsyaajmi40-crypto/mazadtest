module.exports = {
    apps: [
        {
            name: "mazad-api",
            script: "./server.js",
            cwd: "./",
            instances: 1, // Single instance to prevent Cron Job conflicts on a single VPS
            exec_mode: "fork",
            watch: false,
            max_memory_restart: "1G",
            env_production: {
                NODE_ENV: "production",
                PORT: 5000,
            },
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "./logs/error.log",
            out_file: "./logs/output.log",
            merge_logs: true,
            time: true
        }
    ]
};
