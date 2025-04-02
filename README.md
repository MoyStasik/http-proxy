# http-proxy

## 1. Проксирование HTTP запросов

Должны успешно проксироваться HTTP запросы. Команда curl -x http://127.0.0.1:8080 http://mail.ru (8080 – порт, на котором запущена программа) должна возвращать

```
<html>
<head><title>301 Moved Permanently</title></head>
<body bgcolor="white">
<center><h1>301 Moved Permanently</h1></center>
<hr><center>nginx/1.14.1</center>
</body>
</html>
```

На вход прокси приходит запрос вида

GET http://mail.ru/ HTTP/1.1
Host: mail.ru
User-Agent: curl/7.64.1
Accept: */*
Proxy-Connection: Keep-Alive

Необходимо:
+ считать хост и порт из первой строчки
+ заменить путь на относительный
+ удалить заголовок Proxy-Connection
Отправить на считанный хост (mail.ru:80) получившийся запрос

GET / HTTP/1.1
Host: mail.ru
User-Agent: curl/7.64.1
Accept: */*

Перенаправить все, что будет получено в ответ

HTTP/1.1 301 Moved Permanently
Server: nginx/1.14.1
Date: Sat, 12 Sep 2020 08:04:13 GMT
Content-Type: text/html
Content-Length: 185
Connection: close
Location: https://mail.ru/

```
<html>
<head><title>301 Moved Permanently</title></head>
<body bgcolor="white">
<center><h1>301 Moved Permanently</h1></center>
<hr><center>nginx/1.14.1</center>
</body>
</html>
```

Убедиться, что
+ проксируются все типы запросов (GET, POST, HEAD, OPTIONS)
+ проксируются все заголовки
+ корректно возвращаются все коды ответов (200, 302, 404)
