<?php

use Psr\Http\Message\ServerRequestInterface;
use SONFin\Models\CategoryCost;

$app
    ->get('/category-costs', function() use($app){
        $meuModel = new CategoryCost();
        $categories = $meuModel->all();
        $view = $app->service('view.renderer');
        return $view->render('category-costs/list.html.twig',[
            'categories' => $categories
        ]);
    },'category-costs.list')
    ->get('/category-costs/{id}/edit', function(ServerRequestInterface $request) use($app){
        $view = $app->service('view.renderer');
        $id = $request->getAttribute('id');
        $category = CategoryCost::findOrFail($id);
        return $view->render('category-costs/edit.html.twig', [
            'category' => $category
        ]);
    }, 'category-costs.edit')
    ->get('/category-costs/new', function() use($app){
        $view = $app->service('view.renderer');
        return $view->render('category-costs/create.html.twig');
    },'category-costs.new')
    ->get('/category-costs/{id}/show', function(ServerRequestInterface $request) use($app){
        $view = $app->service('view.renderer');
        $id = $request->getAttribute('id');
        $category = \SONFin\Models\CategoryCost::findOrFail($id);
        return $view->render('category-costs/show.html.twig', [
            'category' => $category
        ]);
    }, 'category-costs.show')
    ->get('/category-costs/{id}/delete', function(ServerRequestInterface $request) use($app){
        $id = $request->getAttribute('id');
        $category = \SONFin\Models\CategoryCost::findOrFail($id);
        $category->delete();
        return $app->route('category-costs.list');
    }, 'category-costs.delete')
    ->post('/category-costs/store', function(ServerRequestInterface $request) use($app){
        $data = $request->getParsedBody();
        CategoryCost::create($data);
        return $app->redirect('/category-costs');
    }, 'category-costs.store')
    ->post('/category-costs/{id}/update', function(ServerRequestInterface $request) use($app) {
        $id = $request->getAttribute('id');
        $category = CategoryCost::findOrFail($id);
        $data = $request->getParsedBody();
        $category->fill($data);
        $category->save();
        return $app->route('category-costs.list');
    }, 'category-costs.update');