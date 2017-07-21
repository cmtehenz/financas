<?php
/**
 * Created by PhpStorm.
 * User: Gustavo Costa
 * Date: 21/07/2017
 * Time: 19:12
 */

namespace SONFin\Auth;


interface AuthInterface
{
    public function login(array $credentials): bool;

    public function check(): bool;

    public function logout(): void;

}