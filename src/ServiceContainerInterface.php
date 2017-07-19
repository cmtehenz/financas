<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 19/07/2017
 * Time: 14:18
 */

declare(strict_types=1);

namespace SONFin;


interface ServiceContainerInterface
{
    public function add(string $name, $service);

    public function addLazy(string $name, callable $callable);

    public function get(string $name);

    public function has(string $name);
}