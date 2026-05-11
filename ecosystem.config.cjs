module.exports = {
    apps: [{
        name: "ikkii-api",
        script: "docker",
        args: "compose up --build",
        cwd: ".",
        interpreter: "none",
        exec_mode: "fork",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        env: {
            NODE_ENV: "production"
        },
        log_file: "/dev/null",
        out_file: "/dev/null",
        error_file: "/dev/null"
    }]
};
