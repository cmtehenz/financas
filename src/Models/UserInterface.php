<?php
declare(strict_types=1);

namespace SONFin\Models;


interface UserInterface
{
    public function getId():int;

    public function getFullname():string;

    public function getEmail():string ;

    public function getPassword():string;

}