<?php

namespace SONFin\Models;


use Illuminate\Database\Eloquent\Model;

class CategoryCost extends Model
{
    // Mass Assignment
    protected $fillable = ["id","name", "user_id"];
}