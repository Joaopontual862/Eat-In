-- ============================================================
-- EAT IN — Schema do banco de dados
-- Cole no Supabase > SQL Editor e execute
-- ============================================================

create extension if not exists "uuid-ossp";

create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  created_at timestamptz default now()
);

create table tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  number int not null,
  token text unique not null,
  token_expires_at timestamptz not null,
  created_at timestamptz default now(),
  unique(restaurant_id, number)
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  name text not null,
  sort_order int default 0
);

create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  table_id uuid references tables(id) on delete cascade not null,
  table_number int not null,
  status text check (status in ('new','preparing','ready','delivered')) default 'new',
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  menu_item_id uuid references menu_items(id) on delete restrict not null,
  menu_item_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  notes text
);

create table table_alerts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  table_id uuid references tables(id) on delete cascade not null,
  table_number int not null,
  type text check (type in ('waiter','payment')) not null,
  resolved boolean default false,
  created_at timestamptz default now()
);

-- Desabilita RLS por enquanto (sem autenticação no MVP)
alter table restaurants disable row level security;
alter table tables disable row level security;
alter table categories disable row level security;
alter table menu_items disable row level security;
alter table orders disable row level security;
alter table order_items disable row level security;
alter table table_alerts disable row level security;

-- Realtime para pedidos e alertas
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table table_alerts;

-- Cria o restaurante da cafeteria
insert into restaurants (name, slug)
values ('Café Aroma', 'cafe-aroma');
