<?php

use SONFin\Application;
use SONFin\Plugins\RoutePlugin;
use SONFin\Plugins\ViewPlugin;
use SONFin\ServiceContainer;
use SONFin\Plugins\DbPlugin;
use SONFin\Models\CategoryCost;
use Psr\Http\Message\ServerRequestInterface;


require_once __DIR__ . '/../vendor/autoload.php';

$serviceContainer = new ServiceContainer();
$app = new Application($serviceContainer);

$app->plugin(new RoutePlugin());
$app->plugin(new ViewPlugin());
$app->plugin(new DbPlugin());

$app->get('/home/{name}/{id}', function(ServerRequestInterface $request){
    $response = new \Zend\Diactoros\Response();
    $response->getBody()->write("response com emmiter do diactoros");
    return $response;
});

$meuModel = new \SONFin\Models\CategoryCost();


$app->get('/category-costs', function() use($app){
    $meuModel = new CategoryCost();
    $categories = $meuModel->all();
    $view = $app->service('view.renderer');
    return $view->render('category-costs/list.html.twig',[
        'categories' => $categories
    ]);
});

$app->get('/home', function() {
    echo "Mostrando a home!!";
});

$app->start();