# EU VAT server

SOAP mock for the `retrieveVatRates` call made by charging: one country and
a `situationOn` date. The WSDL contains its schemas, so no EU requests are needed.

Edit `vat-rates.json` to change a country's standard VAT percentage. The folder
is mounted read-only and the JSON is read on every request; no restart is needed.
The initial 27 EU standard rates were checked on 2026-11-12 against the
[Your Europe table](https://europa.eu/youreurope/business/finance-and-tax/vat/vat-rules-rates/index_en.htm).
Greece uses `EL`, as sent by charging. Rates are fixed fixtures for every date;
historical, reduced and regional rates are not simulated.

From the E2E workspace, with Docker network `main` available, run:
`docker compose -f EUVAT-server/docker-compose.yml up -d --build --wait`.
Setup and reload start it before charging; cleanup leaves it running.

- Health: `http://localhost:4202/health`
- WSDL: `http://localhost:4202/taxation_customs/tedb/ws/VatRetrievalService.wsdl`
- SOAP: `http://localhost:4202/taxation_customs/tedb/ws/`

Charging uses `BAE_CB_VAT_URL` for both WSDL and SOAP. E2E defaults to
`http://euvat-server:4202/taxation_customs/tedb/ws/`. Use
`https://ec.europa.eu/taxation_customs/tedb/ws/` for the real service,
which remains charging's default when the variable is unset.

Tests: `python3 -B -m unittest discover -s EUVAT-server -p 'test_*.py'`.
