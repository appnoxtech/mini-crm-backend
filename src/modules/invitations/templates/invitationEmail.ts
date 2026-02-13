export const invitationEmailTemplate = (companyName: string, inviteUrl: string) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1f36;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
        }
        .company-name {
          font-size: 24px;
          font-weight: 700;
          color: #4f46e5;
          margin: 0;
        }
        .content {
          padding: 32px;
          background-color: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        h1 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 16px;
        }
        p {
          margin-bottom: 24px;
          font-size: 16px;
          color: #475569;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          background-color: #4f46e5;
          color: #ffffff !important;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          display: inline-block;
          transition: background-color 0.2s;
        }
        .footer {
          text-align: center;
          margin-top: 32px;
          font-size: 14px;
          color: #94a3b8;
        }
        .expiry-note {
          font-size: 13px;
          color: #94a3b8;
          text-align: center;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <p class="company-name">${companyName}</p>
        </div>
        <div class="content">
          <h1>You've been invited!</h1>
          <p>Hello,</p>
          <p>You have been invited to join <strong>${companyName}</strong> on our CRM platform. Click the button below to set up your account and get started.</p>
          
          <div class="button-container">
            <a href="${inviteUrl}" class="button">Join Organization</a>
          </div>
          
          <p>If you have any questions, please contact your administrator.</p>
        </div>
        <p class="expiry-note">This invitation link will expire in 7 days.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Mini CRM. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

    const text = `
    You've been invited to join ${companyName} on our CRM platform.
    
    Join Organization: ${inviteUrl}
    
    This invitation link will expire in 7 days.
    
    If you did not expect this invitation, you can safely ignore this email.
  `;

    return { html, text };
};
