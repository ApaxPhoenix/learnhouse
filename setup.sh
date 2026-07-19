#!/bin/bash
set -e

apt-get update
apt-get install -y nginx ufw certbot python3-certbot-nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

cat << 'EOF' > /etc/nginx/sites-available/learnhouse.lhscommons.org
server {
    listen 80;
    server_name learnhouse.lhscommons.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

cat << 'EOF' > /etc/nginx/sites-available/cms.lhscommons.org
server {
    listen 80;
    server_name cms.lhscommons.org;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/learnhouse.lhscommons.org /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/cms.lhscommons.org /etc/nginx/sites-enabled/

nginx -t
systemctl restart nginx

certbot --nginx -d learnhouse.lhscommons.org -d cms.lhscommons.org