"""Pruebas unitarias del contrato SIN cargar el modelo.

Se pueden ejecutar con cualquier Python 3 estándar:
    python -m unittest -v test_contract

server.py importa transformers/torch de forma perezosa, por lo que importar
este módulo no intenta cargar los ~16 GB del modelo.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import server  # noqa: E402


class ValidationTests(unittest.TestCase):
    def test_valid_payload_is_normalized(self):
        payload = {
            "messages": [
                {"role": "user", "content": "  Hola  ", "image": "se ignora"},
                {"role": "assistant", "content": "Previo"},
            ],
            "max_new_tokens": 128,
            "campo_extra": "se ignora",
        }
        self.assertEqual(
            server.validate_chat_payload(payload),
            {
                "messages": [
                    {"role": "user", "content": "Hola"},
                    {"role": "assistant", "content": "Previo"},
                ],
                "max_new_tokens": 128,
            },
        )

    def test_default_max_new_tokens(self):
        result = server.validate_chat_payload({"messages": [{"role": "user", "content": "Hola"}]})
        self.assertEqual(result["max_new_tokens"], server.DEFAULT_MAX_NEW_TOKENS)

    def test_accepts_system_role(self):
        result = server.validate_chat_payload(
            {"messages": [{"role": "system", "content": "Reglas"}, {"role": "user", "content": "Hola"}]}
        )
        self.assertEqual(len(result["messages"]), 2)

    def test_rejects_non_dict_payload(self):
        with self.assertRaises(server.ValidationError):
            server.validate_chat_payload(["no", "es", "un", "dict"])

    def test_rejects_missing_or_empty_messages(self):
        for payload in ({}, {"messages": None}, {"messages": []}):
            with self.subTest(payload=payload), self.assertRaises(server.ValidationError):
                server.validate_chat_payload(payload)

    def test_rejects_too_many_messages(self):
        messages = [{"role": "user", "content": "x"} for _ in range(server.MAX_MESSAGES + 1)]
        with self.assertRaises(server.ValidationError):
            server.validate_chat_payload({"messages": messages})

    def test_rejects_invalid_roles_including_unhashable(self):
        for role in ("tool", "", None, ["user"]):
            with self.subTest(role=role), self.assertRaises(server.ValidationError):
                server.validate_chat_payload({"messages": [{"role": role, "content": "Hola"}]})

    def test_rejects_invalid_content(self):
        for content in (None, 123, "   ", "x" * (server.MAX_MESSAGE_CHARS + 1)):
            with self.subTest(content=str(content)[:20]), self.assertRaises(server.ValidationError):
                server.validate_chat_payload({"messages": [{"role": "user", "content": content}]})

    def test_rejects_excessive_total_length(self):
        messages = [
            {"role": "user", "content": "x" * server.MAX_MESSAGE_CHARS} for _ in range(5)
        ]
        with self.assertRaises(server.ValidationError):
            server.validate_chat_payload({"messages": messages})

    def test_rejects_invalid_max_new_tokens(self):
        for value in (True, False, 12.5, "128", 63, 1025, -1):
            with self.subTest(value=value), self.assertRaises(server.ValidationError):
                server.validate_chat_payload(
                    {"messages": [{"role": "user", "content": "Hola"}], "max_new_tokens": value}
                )

    def test_accepts_token_boundaries(self):
        for value in (server.MIN_NEW_TOKENS, server.MAX_NEW_TOKENS):
            with self.subTest(value=value):
                result = server.validate_chat_payload(
                    {"messages": [{"role": "user", "content": "Hola"}], "max_new_tokens": value}
                )
                self.assertEqual(result["max_new_tokens"], value)


class AuthTests(unittest.TestCase):
    def test_correct_token(self):
        self.assertTrue(server.is_authorized("Bearer secreto", "secreto"))

    def test_wrong_or_missing_header(self):
        self.assertFalse(server.is_authorized("Bearer otro", "secreto"))
        self.assertFalse(server.is_authorized(None, "secreto"))
        self.assertFalse(server.is_authorized("", "secreto"))
        self.assertFalse(server.is_authorized("secreto", "secreto"))

    def test_empty_token_is_fail_closed(self):
        self.assertFalse(server.is_authorized("Bearer ", ""))
        self.assertFalse(server.is_authorized("Bearer secreto", None))

    def test_non_ascii_header_does_not_raise(self):
        self.assertFalse(server.is_authorized("Bearer ñ", "secreto"))


class ConfigParserTests(unittest.TestCase):
    def test_timeout(self):
        self.assertEqual(server.parse_timeout("30"), 30.0)
        for bad in (None, "abc", "0", "-1", "nan", "inf", "5000"):
            with self.subTest(bad=bad):
                self.assertEqual(server.parse_timeout(bad), server.DEFAULT_TIMEOUT)

    def test_port(self):
        self.assertEqual(server.parse_port("9000"), 9000)
        for bad in (None, "abc", "0", "70000"):
            with self.subTest(bad=bad):
                self.assertEqual(server.parse_port(bad), server.DEFAULT_PORT)

    def test_dtype(self):
        self.assertEqual(server.parse_dtype("float16"), "float16")
        self.assertEqual(server.parse_dtype(" BFLOAT16 "), "bfloat16")
        self.assertEqual(server.parse_dtype("desconocido"), "auto")

    def test_max_tokens_setting(self):
        self.assertEqual(server.parse_max_tokens_setting("256"), 256)
        for bad in (None, "x", "1", "2048"):
            with self.subTest(bad=bad):
                self.assertEqual(
                    server.parse_max_tokens_setting(bad), server.DEFAULT_MAX_NEW_TOKENS
                )


class SystemGuardTests(unittest.TestCase):
    def test_guard_is_always_first_and_single(self):
        messages = [
            {"role": "user", "content": "Hola"},
            {"role": "system", "content": "Regla del PHP"},
            {"role": "assistant", "content": "Previo"},
        ]
        guarded = server.apply_system_guard(messages)
        self.assertEqual(len(guarded), 3)
        self.assertEqual(guarded[0]["role"], "system")
        self.assertIn(server.SYSTEM_GUARD, guarded[0]["content"])
        self.assertIn("Regla del PHP", guarded[0]["content"])
        self.assertEqual(guarded[1]["role"], "user")
        self.assertEqual(guarded[2]["role"], "assistant")

    def test_no_system_message_in_input(self):
        messages = [{"role": "user", "content": "Hola"}]
        guarded = server.apply_system_guard(messages)
        self.assertEqual(len(guarded), 2)
        self.assertEqual(guarded[0]["content"], server.SYSTEM_GUARD)
        self.assertEqual(guarded[1], messages[0])


class ResponseCleaningTests(unittest.TestCase):
    def test_strips_special_tokens(self):
        self.assertEqual(server.clean_response("<bos>Hola<eos>"), "Hola")
        self.assertEqual(server.clean_response("Hola<end_of_turn>"), "Hola")
        self.assertEqual(server.clean_response("Hola<|eot_id|>"), "Hola")

    def test_removes_thinking_block(self):
        text = "<think>razonamiento interno</think><eos>Respuesta final"
        self.assertEqual(server.clean_response(text), "Respuesta final")

    def test_extract_parsed_text(self):
        self.assertEqual(server.extract_parsed_text("lista"), "lista")
        self.assertEqual(server.extract_parsed_text({"response": "lista"}), "lista")
        self.assertIsNone(server.extract_parsed_text({"otro": "lista"}))
        self.assertIsNone(server.extract_parsed_text(None))

    def test_system_guard_covers_required_rules(self):
        guard = server.SYSTEM_GUARD.lower()
        for fragment in ("galax pc repair", "precios", "stock", "sql", "ignora"):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, guard)


if __name__ == "__main__":
    unittest.main(verbosity=2)
