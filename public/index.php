<?php

use SONFin\Application;
use SONFin\Plugins\RoutePlugin;
use SONFin\ServiceContainer;

require_once __DIR__ . '/../vendor/autoload.php';

$serviceContainer = new ServiceContainer();
$app = new Application($serviceContainer);

$app->plugin(new RoutePlugin());

$app->get('/', function() {
    echo "Hello World!";
});

$app->get('/home', function() {
    echo "Mostrando a home!!";
});

$app->start();