<?php

use Phinx\Seed\AbstractSeed;

class BillReceivesSeeder extends AbstractSeed
{
    const NAMES = [
        'Salário',
        'Bico',
        'Restituição de Imposto de Renda',
        'Venda de produtos usados',
        'Bolsa de valores',
        'CDI',
        'Tesouro direto',
        'EA'
    ];


    public function run()
    {
        $faker = \Faker\Factory::create('pt_BR');
        $faker->addProvider($this);
        $billReceives = $this->table('bill_receives');
        $data = [];
        foreach (range(1, 20) as $value) {
            $data[] = [
                'date_launch' => $faker->date(),
                'name' => $faker->billReceivesName(),
                'user_id' => rand(1,4),
                'value' => $faker->randomFloat(2,10,5000),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];
        }
        $billReceives->insert($data)->save();
    }

    public function billReceivesName(){
        return \Faker\Provider\Base::randomElement(self::NAMES);
    }
}
