<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 19/07/2017
 * Time: 14:55
 */

namespace SONFin\Plugins;


use SONFin\ServiceContainerInterface;

interface PluginInterface
{
    public function register(ServiceContainerInterface $container);
}