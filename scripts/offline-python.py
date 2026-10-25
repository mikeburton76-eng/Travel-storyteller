"""Run the local benchmark with outgoing networking denied by Linux seccomp.

This filter only restricts this process and its descendants; it does not alter
system network settings or allow any previously denied connection.
"""
import ctypes
import errno
import os
from pathlib import Path
import runpy
import sys

libc = ctypes.CDLL(None, use_errno=True)
seccomp = ctypes.CDLL("libseccomp.so.2", use_errno=True)
seccomp.seccomp_init.argtypes = [ctypes.c_uint32]
seccomp.seccomp_init.restype = ctypes.c_void_p
seccomp.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
seccomp.seccomp_syscall_resolve_name.restype = ctypes.c_int
seccomp.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
seccomp.seccomp_rule_add.restype = ctypes.c_int
seccomp.seccomp_load.argtypes = [ctypes.c_void_p]
seccomp.seccomp_load.restype = ctypes.c_int
seccomp.seccomp_release.argtypes = [ctypes.c_void_p]

if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
    raise RuntimeError("Cannot enable no-new-privileges; refusing to run.")
context = seccomp.seccomp_init(0x7FFF0000)  # Allow everything except the deny rules.
if not context:
    raise RuntimeError("Cannot create seccomp filter; refusing to run.")
try:
    for name in (b"socket", b"connect", b"sendto", b"sendmsg", b"sendmmsg"):
        number = seccomp.seccomp_syscall_resolve_name(name)
        if number >= 0 and seccomp.seccomp_rule_add(context, 0x00050000 | errno.EPERM, number, 0) != 0:
            raise RuntimeError("Cannot add network deny rule; refusing to run.")
    if seccomp.seccomp_load(context) != 0:
        raise RuntimeError("Cannot install network deny filter; refusing to run.")
finally:
    seccomp.seccomp_release(context)

# Drop any inherited non-stdio descriptors as well as blocking new sockets.
os.closerange(3, 65536)
import socket
try:
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
except PermissionError:
    print("Offline isolation verified: network socket creation denied.", file=sys.stderr)
else:
    probe.close()
    raise RuntimeError("Network isolation failed; refusing to run.")

target = Path(sys.argv.pop(1)).resolve()
if target.parent != Path(__file__).resolve().parent:
    raise RuntimeError("Only local voice scripts are allowed.")
sys.argv[0] = str(target)
sys.path.insert(0, str(target.parent))
runpy.run_path(str(target), run_name="__main__")
