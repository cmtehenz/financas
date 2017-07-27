<?php

use Phinx\Seed\AbstractSeed;

class CategoryCostsSeeder extends AbstractSeed
{
    const NAMES = [
      'Alimentação',
        'Banco',
        'Cuidados Pessoais',
        'Despesas Imprevisiveis',
        'Educação',
        'Investimento',
        'Lazer',
        'Moradia',
        'Outros',
        'Saúde',
        'Telefonia',
        'Transporte',
        'Utilidades',
        'Vestuario',
        'Pet'
    ];


    public function run()
    {
        $faker = \Faker\Factory::create('pt_BR');
        $faker->addProvider($this);
        $categoryCosts = $this->table('category_costs');
        $data = [];
        foreach (range(1, 20) as $value) {
            $data[] = [
                'name' => $faker->categoryName(),
                'user_id' => rand(1,4),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];
        }
        $categoryCosts->insert($data)->save();
    }

    public function categoryName(){
        return \Faker\Provider\Base::randomElement(self::NAMES);
    }
}
