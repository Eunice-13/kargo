"""Read-only AES-256 verification for macOS encrypted sparsebundles.

hdiutil imageinfo on current macOS omits the cipher for sparsebundles.
Require native isencrypted recognition AND the encrcdsa v2 header's AES
algorithm/key-size fields, not a substring in filenames or utility output.
Only the fixed 76-byte prefix is read: no wrapped keys or passphrases.
Header layout: https://github.com/nlitsme/encrypteddmg/blob/master/readencrcdsa.py
Validated separately against native hdiutil AES-128 and AES-256 images.
This verifies cipher metadata, not passphrase recovery or file integrity;
authenticated reopen and restore checks remain mandatory before release.
"""

import json
import os
import plistlib
import stat
import struct
import subprocess
import sys
import uuid
from pathlib import Path


class MetadataUnavailable(ValueError):
    """Unknown or ambiguous metadata: fail closed, without claiming no encryption."""


class EncryptionRequirementError(ValueError):
    """Recognized metadata fails the AES-256 requirement."""


def validate_header(header):
    if len(header) != 76 or header[:8] != b"encrcdsa":
        raise MetadataUnavailable("Unsupported or truncated encryption header")
    version, iv_size, mode, algorithm, bits, iv_algorithm, iv_bits = struct.unpack_from(
        ">7I", header, 8
    )
    if version != 2:
        raise MetadataUnavailable("Unsupported encryption header version")
    if (iv_size, mode, algorithm, iv_algorithm, iv_bits) != (16, 5, 0x80000001, 91, 160):
        raise MetadataUnavailable("Unsupported encryption algorithm or parameters")
    if bits != 256:
        raise EncryptionRequirementError("Encryption key length is not 256 bits")
    if struct.unpack_from(">I", header, 52)[0] != 512:
        raise MetadataUnavailable("Unsupported encryption block size")
    return {"encrypted": True, "cipher": "AES-256", "headerVersion": 2,
            "verification": "hdiutil recognition plus matching encrcdsa AES/key-size metadata"}


def validate_metadata(native, header):
    if not isinstance(native, dict) or type(native.get("encrypted")) is not bool:
        raise MetadataUnavailable("Native encrypted status is missing or ambiguous")
    if native["encrypted"] is not True:
        raise EncryptionRequirementError("macOS reports an unencrypted image")
    evidence = validate_header(header)
    if type(native.get("version")) is not int or native["version"] != 2:
        raise MetadataUnavailable("Unsupported or conflicting encryption versions")
    try:
        native_id = uuid.UUID(native["uuid"])
    except (KeyError, ValueError, TypeError, AttributeError):
        raise MetadataUnavailable("Native encryption UUID is unavailable") from None
    if native_id != uuid.UUID(bytes=bytes(header[36:52])):
        raise MetadataUnavailable("Native and on-disk image identities conflict")
    return evidence


def validate_attached(native, image, header, owner):
    # isencrypted cannot open a busy sparsebundle. The running DiskImages
    # driver's exact image mapping supplies native encryption recognition.
    matches = [entry for entry in native.get("images", [])
               if entry.get("image-path") == str(image)]
    if len(matches) != 1:
        raise MetadataUnavailable("Mounted image identity is missing or ambiguous")
    entry = matches[0]
    if entry.get("image-encrypted") is not True or entry.get("owner-uid") != owner:
        raise MetadataUnavailable("Mounted encryption or owner could not be verified")
    evidence = validate_header(header)
    evidence["verification"] = "native mounted-image mapping plus encrcdsa AES/key-size metadata"
    return evidence


def regular_prefix(path, count):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise MetadataUnavailable("Expected a regular metadata file")
        return os.read(descriptor, count)
    finally:
        os.close(descriptor)


def verify_image(image):
    image = Path(image).absolute()
    if image.suffix != ".sparsebundle" or not stat.S_ISDIR(image.lstat().st_mode):
        raise MetadataUnavailable("Expected a nonsymlink sparsebundle directory")
    bundle = plistlib.loads(regular_prefix(image / "Info.plist", 65536))
    if bundle.get("diskimage-bundle-type") != "com.apple.diskimage.sparsebundle":
        raise MetadataUnavailable("Unsupported bundle type")
    result = subprocess.run(
        ["/usr/bin/hdiutil", "isencrypted", str(image), "-plist"],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8"},
        timeout=30,
    )
    header = regular_prefix(image / "token", 76)
    if not result.returncode:
        return validate_metadata(plistlib.loads(result.stdout), header)
    # A failed standalone inspection alone never authorizes an export.
    attached = subprocess.run(
        ["/usr/bin/hdiutil", "info", "-plist"], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8"}, timeout=30,
    )
    if attached.returncode:
        raise MetadataUnavailable("Native encryption inspection failed")
    return validate_attached(plistlib.loads(attached.stdout), image, header, os.getuid())


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise MetadataUnavailable("Specify one sparsebundle path")
        print(json.dumps(verify_image(sys.argv[1])))
    except (MetadataUnavailable, EncryptionRequirementError) as error:
        print(json.dumps({"verified": False, "reason": str(error), "kind": type(error).__name__}))
        sys.exit(1)
    except Exception:
        print(json.dumps({"verified": False, "reason": "Metadata inspection failed"}))
        sys.exit(1)
