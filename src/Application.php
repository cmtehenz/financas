<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 19/07/2017
 * Time: 14:42
 */
declare(strict_types = 1);
namespace SONFin;

use SONFin\Plugins\PluginInterface;

class Application
{
    private $serviceContainer;

    /**
     * Application constructor.
     * @param $serviceContainer
     */
    public function __construct(ServiceContainerInterface $serviceContainer)
    {
        $this->serviceContainer = $serviceContainer;
    }

    public function service($name)
    {
        return $this->serviceContainer->get($name);
    }

    public function addService(string $name, $service)
    {
        if (is_callable($service)) {
            $this->serviceContainer->addLazy($name, $service);
        } else {
            $this->serviceContainer->add($name, $service);
        }
    }

    public function plugin(PluginInterface $plugin)
    {
        $plugin->register($this->serviceContainer);
    }
}