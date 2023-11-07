## Запуск

### Если есть Docker:
```shell
make prepare && make start
```

### Если докера нет:
```shell
make prepare-raw && make start-raw
```

- Перед запуском нужно заполнить файл `./.deploy/.env` или `.env` если используете raw
