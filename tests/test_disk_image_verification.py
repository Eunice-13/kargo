import importlib.util
import os
import plistlib
import secrets
import struct
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("disk_image", ROOT / "scripts/recovery/verify_disk_image.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    identity = uuid.UUID("12345678-1234-4321-9876-123456789abc")
    header = struct.pack(">8s7I16sIQQI", b"encrcdsa", 2, 16, 5, 0x80000001,
                         256, 91, 160, identity.bytes, 512, 2**31, 122368, 1)
    return {"encrypted": True, "version": 2, "uuid": str(identity)}, bytearray(header)


class MetadataTests(unittest.TestCase):
    def attached(self):
        return {"images": [{"image-path": "/approved.sparsebundle", "image-encrypted": True,
                            "owner-uid": 501}]}

    def test_attached_native_mapping_accepts_aes256(self):
        _, header = fixture()
        self.assertEqual(module.validate_attached(self.attached(), "/approved.sparsebundle", header, 501)["cipher"], "AES-256")

    def test_attached_mapping_does_not_relax_key_length(self):
        _, header = fixture()
        struct.pack_into(">I", header, 24, 128)
        with self.assertRaises(module.EncryptionRequirementError):
            module.validate_attached(self.attached(), "/approved.sparsebundle", header, 501)

    def test_attached_wrong_path_or_owner_fails(self):
        _, header = fixture()
        for image, owner in (("/unrelated.sparsebundle", 501), ("/approved.sparsebundle", 502)):
            with self.assertRaises(module.MetadataUnavailable):
                module.validate_attached(self.attached(), image, header, owner)

    def test_attached_unencrypted_or_ambiguous_driver_fails(self):
        _, header = fixture()
        for value in (False, None, "true", 1):
            native = self.attached()
            native["images"][0]["image-encrypted"] = value
            with self.assertRaises(module.MetadataUnavailable):
                module.validate_attached(native, "/approved.sparsebundle", header, 501)

    def test_attached_duplicate_or_missing_mapping_fails(self):
        _, header = fixture()
        for images in ([], self.attached()["images"] * 2):
            with self.assertRaises(module.MetadataUnavailable):
                module.validate_attached({"images": images}, "/approved.sparsebundle", header, 501)

    def test_native_metadata_without_cipher_text_is_supported(self):
        native, header = fixture()
        self.assertEqual(module.validate_metadata(native, header)["cipher"], "AES-256")

    def test_aes128_is_rejected_even_if_filename_claims_aes256(self):
        native, header = fixture()
        native["name"] = "AES-256.sparsebundle"
        struct.pack_into(">I", header, 24, 128)
        with self.assertRaises(module.EncryptionRequirementError):
            module.validate_metadata(native, header)

    def test_other_key_lengths_are_rejected(self):
        for bits in (0, 192, 512):
            with self.subTest(bits=bits):
                native, header = fixture()
                struct.pack_into(">I", header, 24, bits)
                with self.assertRaises(module.EncryptionRequirementError):
                    module.validate_metadata(native, header)

    def test_native_unencrypted_fails(self):
        native, header = fixture()
        native["encrypted"] = False
        with self.assertRaises(module.EncryptionRequirementError):
            module.validate_metadata(native, header)

    def test_missing_or_coerced_native_status_is_ambiguous(self):
        for value in (None, "true", 1):
            with self.subTest(value=value):
                native, header = fixture()
                native["encrypted"] = value
                with self.assertRaises(module.MetadataUnavailable):
                    module.validate_metadata(native, header)

    def test_truncated_and_corrupt_headers_fail_closed(self):
        native, header = fixture()
        for corrupted in (b"", header[:75], b"AES-256!" + header[8:]):
            with self.subTest(length=len(corrupted)):
                with self.assertRaises(module.MetadataUnavailable):
                    module.validate_metadata(native, corrupted)

    def test_unknown_native_or_header_version_is_ambiguous(self):
        for offset in (None, 8):
            native, header = fixture()
            if offset is None:
                native["version"] = 3
            else:
                struct.pack_into(">I", header, offset, 3)
            with self.assertRaises(module.MetadataUnavailable):
                module.validate_metadata(native, header)

    def test_unknown_cipher_mode_or_iv_fails_closed(self):
        for offset in (12, 16, 20, 28, 32, 52):
            with self.subTest(offset=offset):
                native, header = fixture()
                struct.pack_into(">I", header, offset, 0)
                with self.assertRaises(module.MetadataUnavailable):
                    module.validate_metadata(native, header)

    def test_conflicting_uuid_fails_closed(self):
        native, header = fixture()
        native["uuid"] = str(uuid.uuid4())
        with self.assertRaises(module.MetadataUnavailable):
            module.validate_metadata(native, header)

    def test_missing_uuid_is_ambiguous(self):
        native, header = fixture()
        del native["uuid"]
        with self.assertRaises(module.MetadataUnavailable):
            module.validate_metadata(native, header)

    def test_token_symlinks_are_not_followed(self):
        with tempfile.TemporaryDirectory() as folder:
            real = Path(folder) / "real"
            real.write_bytes(b"not secret")
            link = Path(folder) / "token"
            link.symlink_to(real)
            with self.assertRaises(OSError):
                module.regular_prefix(link, 76)

    def test_image_symlinks_are_not_followed(self):
        with tempfile.TemporaryDirectory() as folder:
            real = Path(folder) / "real"
            real.mkdir()
            link = Path(folder) / "link.sparsebundle"
            link.symlink_to(real)
            with self.assertRaises(module.MetadataUnavailable):
                module.verify_image(link)


@unittest.skipUnless(sys.platform == "darwin" and os.getenv("KARGO_TEST_NATIVE_IMAGES") == "1",
                     "Opt-in disposable native image tests")
class NativeImageTests(unittest.TestCase):
    def check_image(self, cipher):
        # Empty synthetic images only, automatically removed; never KINGSTON.
        with tempfile.TemporaryDirectory(prefix="kargo-native-cipher-", dir="/private/tmp") as folder:
            image = Path(folder) / "reference.sparsebundle"
            password = secrets.token_urlsafe(36).encode() + b"\0"
            args = ["/usr/bin/hdiutil", "create", "-size", "2g", "-type", "SPARSEBUNDLE",
                    "-fs", "APFS", "-volname", "KARGO-Cipher-Test"]
            if cipher:
                args += ["-encryption", cipher, "-stdinpass"]
            result = subprocess.run(args + [str(image)], input=password if cipher else None,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
            self.assertEqual(result.returncode, 0, "Native empty image creation failed")
            if cipher == "AES-256":
                self.assertEqual(module.verify_image(image)["cipher"], "AES-256")
                result = subprocess.run(["/usr/bin/hdiutil", "imageinfo", str(image), "-stdinpass", "-plist"],
                                        input=password, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
                self.assertEqual(result.returncode, 0)
                self.assertIs(plistlib.loads(result.stdout)["Properties"]["Encrypted"], True)
            else:
                with self.assertRaises(module.EncryptionRequirementError):
                    module.verify_image(image)
            if cipher:
                attached = subprocess.run(["/usr/bin/hdiutil", "attach", str(image), "-readonly", "-nomount", "-stdinpass", "-plist"],
                                          input=password, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
                self.assertEqual(attached.returncode, 0, "Native read-only attach failed")
                device = plistlib.loads(attached.stdout)["system-entities"][0]["dev-entry"]
                try:
                    if cipher == "AES-256":
                        self.assertEqual(module.verify_image(image)["cipher"], "AES-256")
                    else:
                        with self.assertRaises(module.EncryptionRequirementError):
                            module.verify_image(image)
                finally:
                    result = subprocess.run(["/usr/bin/hdiutil", "detach", device], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    self.assertEqual(result.returncode, 0, "Synthetic read-only image detach failed")

    def test_real_aes256_is_accepted(self):
        self.check_image("AES-256")

    def test_real_aes128_is_rejected(self):
        self.check_image("AES-128")

    def test_real_unencrypted_image_is_rejected(self):
        self.check_image(None)


if __name__ == "__main__":
    unittest.main()
