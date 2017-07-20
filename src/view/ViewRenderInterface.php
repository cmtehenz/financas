<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 20/07/2017
 * Time: 15:09
 */

declare(strict_types=1);

namespace SONFin\View;

use Psr\Http\Message\ResponseInterface;

interface ViewRenderInterface
{
    public function render(string $template, array $context = []): ResponseInterface;
}