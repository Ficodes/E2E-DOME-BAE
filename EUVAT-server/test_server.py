import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from xml.etree import ElementTree as ET

from server import SOAP_NS, SERVICE_NS, SERVICE_PATH, TYPES_NS, WSDL_PATH, VatHandler


class VatServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.logs = patch.object(VatHandler, "log_message")
        cls.logs.start()
        cls.rates_patch = patch("server.RATES_FILE")
        cls.rates_file = cls.rates_patch.start()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), VatHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.rates_patch.stop()
        cls.logs.stop()

    def setUp(self):
        self.rates_file.read_text.return_value = '{"ES": 21, "FI": 25.5, "EL": 24}'

    def request(self, method, path, payload=None):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        try:
            connection.request(method, path, body=payload, headers={"Content-Type": "text/xml"})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def soap(self, country):
        envelope = ET.Element(f"{{{SOAP_NS}}}Envelope")
        body = ET.SubElement(envelope, f"{{{SOAP_NS}}}Body")
        request = ET.SubElement(body, f"{{{SERVICE_NS}}}retrieveVatRatesReqMsg")
        members = ET.SubElement(request, f"{{{TYPES_NS}}}memberStates")
        ET.SubElement(members, f"{{{TYPES_NS}}}isoCode").text = country
        ET.SubElement(request, f"{{{TYPES_NS}}}situationOn").text = "2026-11-12"
        return self.request("POST", SERVICE_PATH, ET.tostring(envelope))

    def test_health(self):
        self.assertEqual(self.request("GET", "/health"), (200, b"ok"))

    def test_wsdl_has_local_address_and_no_remote_schema_downloads(self):
        status, payload = self.request("GET", WSDL_PATH)
        self.assertEqual(status, 200)
        root = ET.fromstring(payload)
        address = root.find(".//{http://schemas.xmlsoap.org/wsdl/soap/}address")
        self.assertEqual(address.attrib["location"],
                         f"http://127.0.0.1:{self.server.server_port}{SERVICE_PATH}")
        self.assertFalse(any("schemaLocation" in node.attrib for node in root.iter()))

    def test_soap_returns_standard_rates_including_decimals(self):
        for country, expected in [("ES", "21"), ("FI", "25.5")]:
            with self.subTest(country=country):
                status, payload = self.soap(country)
                self.assertEqual(status, 200)
                result = ET.fromstring(payload).find(f".//{{{TYPES_NS}}}vatRateResults")
                self.assertEqual(result.findtext(f"{{{TYPES_NS}}}memberState"), country)
                self.assertEqual(result.findtext(f"{{{TYPES_NS}}}type"), "STANDARD")
                self.assertEqual(result.findtext(f"{{{TYPES_NS}}}rate/{{{TYPES_NS}}}value"), expected)

    def test_rates_reload_without_restarting(self):
        self.assertIn(b">21<", self.soap("ES")[1])
        self.rates_file.read_text.return_value = '{"ES": 10}'
        self.assertIn(b">10<", self.soap("ES")[1])

    def test_bad_country_and_invalid_json_return_soap_fault(self):
        for rates, country in [('{"ES": 21}', "ZZ"), ("invalid JSON", "ES")]:
            with self.subTest(rates=rates, country=country):
                self.rates_file.read_text.return_value = rates
                status, payload = self.soap(country)
                self.assertEqual(status, 500)
                self.assertIsNotNone(ET.fromstring(payload).find(f".//{{{SOAP_NS}}}Fault"))


if __name__ == "__main__":
    unittest.main()
