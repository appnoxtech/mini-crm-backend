module.exports = {
  apps: [
    {
      name: 'mini-crm-backend',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        
        // Database Configuration
        DATABASE_PATH: 'data.db',
        
        // Server Configuration
        PORT: 4000,
        FRONTEND_URL: 'https://your-domain.com',
        
        // JWT Configuration
        JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
        TOKEN_ENCRYPTION_KEY: 'your-token-encryption-key-change-in-production',
        
        // Google OAuth Configuration
        GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'your-google-client-secret',
        GOOGLE_REDIRECT_URI: 'https://your-domain.com/api/emails/oauth/gmail/callback',
        
        // Email Configuration
        TRACKING_BASE_URL: 'https://your-domain.com',
        
        // RunPod Configuration
        RUNPOD_API_URL: 'https://api.runpod.ai/v2/your-endpoint/run',
        RUNPOD_API_KEY: 'your-runpod-api-key',
        
        // Redis URL
        REDIS_URL: 'redis://127.0.0.1:6379',
        
        // Twilio Configuration
        TWILIO_ACCOUNT_SID: 'your-twilio-account-sid',
        TWILIO_AUTH_TOKEN: 'your-twilio-auth-token',
        TWILIO_API_KEY_SID: 'your-twilio-api-key-sid',
        TWILIO_API_KEY_SECRET: 'your-twilio-api-key-secret',
        TWILIO_TWIML_APP_SID: 'your-twilio-twiml-app-sid',
        TWILIO_CALLER_ID: '+1234567890',
        TWILIO_RECORDING_ENABLED: 'true',
        TWILIO_TRANSCRIPTION_ENABLED: 'false',
        TWILIO_RECORDING_CHANNELS: 'dual',
        TWILIO_WEBHOOK_BASE_URL: 'https://your-domain.com',
        
        // AWS S3 Configuration
        AWS_ACCESS_KEY_ID: 'your-aws-access-key-id',
        AWS_SECRET_ACCESS_KEY: 'your-aws-secret-access-key',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'your-s3-bucket-name'
      },
      error_file: '~/.pm2/logs/mini-crm-backend-error.log',
      out_file: '~/.pm2/logs/mini-crm-backend-out.log',
      log_file: '~/.pm2/logs/mini-crm-backend-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
