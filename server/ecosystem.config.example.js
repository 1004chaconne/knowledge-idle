/* pm2 启动配置：pm2 start ecosystem.config.js */
module.exports = {
  apps: [{
    name: 'sapere-game',
    script: 'src/index.js',
    cwd: __dirname,
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 9400,
      HOST: '127.0.0.1',
      /* 部署前一定要改：openssl rand -hex 24 */
      COOKIE_SECRET: 'CHANGE_ME_BEFORE_DEPLOY',
      DATA_FILE: './data/db.json',
    },
  }],
};
