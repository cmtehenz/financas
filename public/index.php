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


$app
    ->get('/category-costs', function() use($app){
        $meuModel = new CategoryCost();
        $categories = $meuModel->all();
        $view = $app->service('View.renderer');
        return $view->render('category-costs/list.html.twig',[
            'categories' => $categories
        ]);
    })
    ->get('/category-costs/new', function() use($app){
        $view = $app->service('View.renderer');
        return $view->render('category-costs/create.html.twig');
    },'category-costs.new')
    ->post('/category-costs/store', function(ServerRequestInterface $request) use($app){
        $data = $request->getParsedBody();
        CategoryCost::create($data);
        return $app->redirect('/category-costs');
    }, 'category-costs.store');

$app->start();