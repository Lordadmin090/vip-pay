-- Extend app_settings for withdrawals / conversion admin knobs. Run after app_settings.sql.

alter table public.app_settings add column if not exists min_withdraw_coins numeric not null default 1000;
alter table public.app_settings add column if not exists gas_fee numeric not null default 2;
alter table public.app_settings add column if not exists min_convert_coins numeric not null default 1000;
alter table public.app_settings add column if not exists max_convert_coins numeric not null default 5000000;
alter table public.app_settings add column if not exists min_withdraw_usd numeric not null default 1;
alter table public.app_settings add column if not exists min_topup_usd numeric not null default 1;
alter table public.app_settings add column if not exists ngn_per_usd numeric not null default 1600;
alter table public.app_settings add column if not exists ghs_per_usd numeric not null default 15;
alter table public.app_settings add column if not exists ngn_bank_name text not null default 'Wema Bank';
alter table public.app_settings add column if not exists ngn_account_number text not null default '0123456789';
alter table public.app_settings add column if not exists ngn_account_name text not null default 'VIBEPAY GLOBAL VENTURES';
alter table public.app_settings add column if not exists ghs_bank_name text not null default 'VibePay Africa Ltd';
alter table public.app_settings add column if not exists ghs_merchant_number text not null default '0541 234 567';
alter table public.app_settings add column if not exists ghs_account_name text not null default 'VIDPAY';
alter table public.app_settings add column if not exists usdt_network text not null default 'TRC20';
alter table public.app_settings add column if not exists usdt_wallet_address text not null default '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

comment on column public.app_settings.min_withdraw_coins is 'Minimum coin balance required before withdrawal eligibility.';
comment on column public.app_settings.gas_fee is 'USD deducted from gas_fee_balance per withdrawal.';
comment on column public.app_settings.min_convert_coins is 'Minimum coins per convert-to-USD action.';
comment on column public.app_settings.max_convert_coins is 'Maximum coins per convert-to-USD action.';
comment on column public.app_settings.min_withdraw_usd is 'Minimum USD ready amount required for USD withdrawals.';
comment on column public.app_settings.min_topup_usd is 'Minimum topup amount (USD) for manual deposits.';
comment on column public.app_settings.ngn_per_usd is 'FX rate: how many NGN per $1.';
comment on column public.app_settings.ghs_per_usd is 'FX rate: how many GHS per $1.';
comment on column public.app_settings.ngn_bank_name is 'NGN deposit bank name.';
comment on column public.app_settings.ngn_account_number is 'NGN deposit account number.';
comment on column public.app_settings.ngn_account_name is 'NGN deposit account name.';
comment on column public.app_settings.ghs_bank_name is 'GHS deposit bank/merchant display name.';
comment on column public.app_settings.ghs_merchant_number is 'GHS deposit merchant number.';
comment on column public.app_settings.ghs_account_name is 'GHS deposit account name.';
comment on column public.app_settings.usdt_network is 'USDT deposit network (e.g. TRC20, BEP20, ERC20).';
comment on column public.app_settings.usdt_wallet_address is 'USDT deposit wallet address for the selected network.';
