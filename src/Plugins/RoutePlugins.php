<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 19/07/2017
 * Time: 15:14
 */

namespace SONFin\Plugins;


use Aura\Router\RouterContainer;
use SONFin\ServiceContainerInterface;

class RoutePlugins implements PluginInterface
{
    public function register(ServiceContainerInterface $container)
    {
        $routerContainer = new RouterContainer();
        /* Registrar as rotas da aplicação */
        $map = $routerContainer->getMap();
        $matcher = $routerContainer->getMatcher();
        $generator = $routerContainer->getGenerator();

        $container->add('routing',$map);
        $container->add('routing.matcher', $matcher);
        $container->add('routing.generator', $generator);
                

    }
}