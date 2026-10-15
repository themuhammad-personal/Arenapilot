#!/usr/bin/env python3
"""Build pinned GPL-2.0 PRoot + matching loaders with Android fork compatibility.

Uses the NDK and SHA-verified Termux dependency libraries/headers staged by
fetch_sandbox_deps.py. No downloaded executable is run on the build host.
Source + patch provenance goes into the APK manifest; outputs stay ignored.
"""
import hashlib
import io
import os
import pathlib
import shutil
import subprocess
import tarfile

SOURCE_COMMIT = 'b8c1f5c5c6730dc9d521d5bd5ce1cfeedecde087'
SOURCE_SHA256 = 'b2dd751e3e4083f4a7dd2104a6330daa3823e9c2410d2a5bd43bfa97ea989d42'
NDK_VERSION = '27.2.12479018'
TARGETS = {'arm64-v8a': 'aarch64-linux-android', 'armeabi-v7a': 'armv7a-linux-androideabi', 'x86_64': 'x86_64-linux-android', 'x86': 'i686-linux-android'}
ROOT = pathlib.Path(__file__).resolve().parents[1]


def extract_source(data, dest):
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Pinned PRoot source SHA-256 mismatch')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for item in archive.getmembers():
            parts = pathlib.PurePosixPath(item.name).parts
            if not parts or parts[0] != 'proot-' + SOURCE_COMMIT or '..' in parts:
                raise ValueError('Unsafe PRoot source archive path')
            if not item.isfile():
                continue
            target = dest.joinpath(*parts[1:])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(item).read())


def run_build(command, cwd, env):
    result = subprocess.run(command, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(result.stdout, flush=True)
    if result.returncode:
        lines = [line for line in result.stdout.splitlines() if any(word in line.lower() for word in ['error:', 'undefined reference', 'error '])]
        text = '\n'.join(lines[:10] or result.stdout.splitlines()[-10:])[:3200]
        print('::error title=Native runtime build::' + text.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A'), flush=True)
        raise RuntimeError('Pinned PRoot build failed; see native runtime annotation')


def build(out_dir, headers, notice):
    from fetch_sandbox_deps import fetch, elf_dynamic, ANDROID_SYSTEM_LIBS
    out = pathlib.Path(out_dir).resolve()
    sdk = pathlib.Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or '/nonexistent')
    tools = sdk / 'ndk' / NDK_VERSION / 'toolchains/llvm/prebuilt/linux-x86_64/bin'
    if not (tools / 'clang').is_file():
        raise RuntimeError(f'Android NDK {NDK_VERSION} is required for patched PRoot')
    work = ROOT / '.cache' / 'proot-build'
    source = work / SOURCE_COMMIT
    if source.exists():
        shutil.rmtree(source)
    source_archive = fetch(f'https://codeload.github.com/termux/proot/tar.gz/{SOURCE_COMMIT}')
    extract_source(source_archive, source)
    patch = ROOT / 'scripts/proot-fork-compat.patch'
    assets = out / 'assets/sandbox'
    assets.mkdir(parents=True, exist_ok=True)
    # Complete pinned upstream source and our patch/build recipe accompany the
    # modified GPL program; this is an aggregate, not an app license change.
    shutil.copyfile(source / 'COPYING', assets / 'PROOT-COPYING.txt')
    shutil.copyfile(patch, assets / 'proot-fork-compat.patch')
    shutil.copyfile(__file__, assets / 'build_proot.py')
    shutil.copyfile(ROOT / 'scripts/fetch_sandbox_deps.py', assets / 'fetch_sandbox_deps.py')
    (assets / 'PROOT-SOURCE.txt').write_text(
        'PRoot (GPL-2.0-or-later), modified for Android legacy fork/vfork compatibility.\n'
        f'Source: https://github.com/termux/proot/tree/{SOURCE_COMMIT}\n'
        f'Archive SHA-256: {SOURCE_SHA256}\n'
        f'Build: Android NDK {NDK_VERSION}; fetch_sandbox_deps.py --patched-proot\n'
        'The upstream source archive, patch, build scripts and GPL text are included here.\n')
    # The source archive is small, platform-independent and included only once.
    (assets / 'proot-source.tar.gz').write_bytes(source_archive)

    subprocess.run(['patch', '-p1', '--batch', '--fuzz=0', '-i', str(patch)], cwd=source, check=True)
    for abi, target in TARGETS.items():
        lib = out / 'jniLibs' / abi
        include = pathlib.Path(headers) / abi
        if not (include / 'talloc.h').is_file():
            raise RuntimeError(f'{abi}: verified talloc headers missing')
        dest = work / abi
        if dest.exists():
            shutil.rmtree(dest)
        # The upstream rule prefixes SRC to $<; a VPATH absolute prerequisite
        # is doubled in out-of-tree builds. Isolate each ABI's in-tree copy.
        shutil.copytree(source, dest)
        dest = dest / 'src'
        env = dict(os.environ)
        env['CPPFLAGS'] = f'-I{include}'
        env['LDFLAGS'] = f'-L{lib}'
        run_build(['make', '-j2',
                        f'CC={tools / (target + "26-clang")}', f'LD={tools / (target + "26-clang")}',
                        f'STRIP={tools / "llvm-strip"}', f'OBJCOPY={tools / "llvm-objcopy"}',
                        f'OBJDUMP={tools / "llvm-objdump"}', 'GIT=false',
                        'HAS_LOADER_32BIT=', 'PROOT_UNBUNDLE_LOADER=/unused'],
                       cwd=dest, env=env)
        for generated, packaged in [('proot', 'libproot.so'), ('loader/loader', 'libproot-loader.so')]:
            binary = dest / generated
            subprocess.run([str(tools / 'llvm-strip'), str(binary)], check=True)
            data = binary.read_bytes()
            dependencies, _ = elf_dynamic(data)
            missing = [name for name in dependencies if name not in ANDROID_SYSTEM_LIBS and not (lib / name).is_file()]
            if missing:
                raise RuntimeError(f'{abi}/{generated}: unresolved ELF dependencies {missing}')
            (lib / packaged).write_bytes(data)
            (lib / packaged).chmod(0o755)
        # One rootfs/loader ABI per app process. Never mix the old loader's
        # statement protocol with the new executable for 32-on-64 guests.
        (lib / 'libproot-loader32.so').unlink(missing_ok=True)
        notice[abi]['sourceCommit'] = SOURCE_COMMIT
        notice[abi]['sourceSha256'] = SOURCE_SHA256
        notice[abi]['forkCompatPatchSha256'] = hashlib.sha256(patch.read_bytes()).hexdigest()
        notice[abi]['ndk'] = NDK_VERSION
        print(f'[sandbox-deps] {abi}: built pinned PRoot + matching loader with fork/vfork compatibility', flush=True)
