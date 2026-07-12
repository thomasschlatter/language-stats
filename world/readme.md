# Stranded

# Connect ssh using file

ssh -i /Users/thomasschlatter/.ssh/id_rsa_share root@157.245.57.182
ssh -i /Users/twang/.ssh/strndd root@157.245.57.182

# python

# runserver

Activate the venv

cmd: source django/venv/bin/activate
powershell: .\django\venv\bin\Activate.ps1
bash: source venv/Scripts/activate

python django/manage.py runserver
py django/manage.py runserver

## Shell

python3 django/manage.py shell

import django

# Certbot

## Setup

docker-compose up -d

## How to get initial ssl

1. in /nginx/config/groupifier.com.conf comment out the ssl stuff
   a. return 301 https://$server_name$request_uri;
   this redirects all http to https, if there is no ssl cert, it will fail
   b. comment out server { ... } block, this is the ssl server block
2. docker compose down; docker compose up -d
3. goto next section: Certbot setup test
4. copy fullchain.pem and privkey.pem to /server/ so that nodejs can find it and wss works

maybe you need to rename folder strndd.com-0002 to strndd.com, otherwise certbot will use an old certificate

after everything is done it can still take a while until all works together

don't forget that the files have to be on the server and not on your local machine, especially folders nginx and certbot

### Certbot setup test

docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ --dry-run -d strndd.com -d www.strndd.com

### Certbot setup

docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d strndd.com -d www.strndd.com

## Instrudcionts

Instructions here:
https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal

## some useful commands

docker-compose ps
docker exec -it home_webserver_1 bash
root@4f289c8a7585:/# cd etc/nginx
root@4f289c8a7585:/etc/nginx# ls
conf.d fastcgi_params mime.types modules nginx.conf scgi_params ssl uwsgi_params
root@4f289c8a7585:/etc/nginx# cd conf.d
root@4f289c8a7585:/etc/nginx/conf.d# ls
strndd.com.conf

## stop and remove

docker stop $(docker ps -aq); docker rm $(docker ps -aq)

# Github authentication

ssh-add ~/.ssh/github

# Connect

ssh -i /Users/thomasschlatter/.ssh/strndd_share root@157.245.57.182
ssh -i C:\Users\twang\.ssh\strndd root@157.245.57.182

# SET UP SSL

use standalone

sudo certbot certonly --standalone -d strndd.com -d www.strndd.com

# Structure of the project

```
GROUPIFIER
├─ ...
├─ .DS_Store
├─ .dockerignore
├─ .env
├─ client
│  ├─ ...
│  ├─ public
│  │  ├─ ...
│  │  ├─ favicon.ico
│  │  └─ robots.txt
│  ├─ src
│  │  ├─ ...
│  │  ├─ index.html
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ yarn.lock
│  └─ tsconfig.json
├─ django
│  ├─ ...
│  ├─ djangopj
│  │  ├─ ...
│  │  ├─ asgi.py
│  │  ├─ settings.py
│  │  ├─ urls.py
│  │  └─ wsgi.py
│  ├─ manage.py
│  ├─ requirements.txt
│  └─ venv
├─ nginx
│  └─ config
│     ├─ ...
│     └─ strndd.com.ssl.conf
├─ server
│  ├─ ...
│  ├─ index.ts
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ rooms
│     ├─ ...
│     └─ SkyOffice.ts
├─ types
│  ├─ ...
│  ├─ BackgroundMode.ts
│  ├─ package.json
│  └─ yarn.lock
├─ docker-compose.yml
├─ DockerfileClient
├─ DockerfileDjango
├─ DockerfileNginx
├─ DockerfileServer
├─ LICENSE
├─ package.json
└─ README.md

```

# No space left on device

docker system prune -a --volumes --force
docker system prune --all --force

# some thoughts regarding wss and the keys

```
const options = {
  key: fs.readFileSync("/app/certbot/config/live/strndd.com/privkey.pem"),
  cert: fs.readFileSync("/app/certbot/config/live/strndd.com/fullchain.pem"),
};
```

some files are symbolic links rather than the actual files, use

ls -l privkey.pem

to find out if it is a symbolic link, if there is an arrow, it is a symbolic link

```
root@80e8c0c5e73d:/app/certbot/config/live/strndd.com# ls -l privkey.pem
-rw-r--r-- 1 root root 241 Sep  2 06:01 privkey.pem
root@80e8c0c5e73d:/app/certbot/config/live/strndd.com# realpath fullchain.pem
```

```
[ -e /strndd.com/privkey.pem ] && echo "File exists" || echo "File does not exist"
```
