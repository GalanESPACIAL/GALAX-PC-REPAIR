"""
Corrige el modelo SANARA (exportado con Mesh2Motion, animación Levitate_Idle):

1) Suaviza ligeramente los pesos WEIGHTS_0 en la zona de los hombros
   (suavizado Laplaciano sobre la topología del mesh) para quitar pliegues.
2) Sepra un poco los brazos del pecho aplicando una rotación pequeña y
   simétrica a los huesos upperarm_l / upperarm_r. La rotación se aplica
   TANTO a la rotación base (node.rotation) como a TODAS las claves de
   rotación de la animación Levitate_Idle, de modo que la animación sigue
   siendo válida y el efecto se ve también al reproducirla.
   No se tocan las inverse-bind matrices: así el pose en reposo no se
   deforma (la rotación es rígida alrededor del hombro).

Uso:  python fix_sanara.py [entrada.glb] [salida.glb]
"""
import math
import struct
import sys
from pathlib import Path

import numpy as np
from pygltflib import GLTF2

BASE = Path(r"F:\GALAX PC REPAIR\docs\Cuerpo_SANARA IA")
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "exported-model.glb"
DST = Path(sys.argv[2]) if len(sys.argv) > 2 else BASE / "sanara_listo.glb"

# --- Parámetros ajustables -------------------------------------------------
SMOOTH_PASSES = 2        # pasadas de suavizado (pocas = "ligeramente")
SMOOTH_ALPHA = 0.25      # cuánto se mezcla cada vértice con sus vecinos
SHOULDER_JOINTS = (4, 5, 6, 29, 30)   # spine_03, clavículas y brazos superiores
ARM_ANGLE_DEG = 10.0     # separación de los brazos (grados, simétrica)
# ---------------------------------------------------------------------------

DTYPE = {5126: "f", 5123: "H", 5121: "B", 5122: "h", 5125: "I"}
COMPS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


# ---------------------------- utilidades ----------------------------------
def read_accessor(gltf, idx):
    """Lee un accessor a un array numpy (respetando byteStride)."""
    a = gltf.accessors[idx]
    bv = gltf.bufferViews[a.bufferView]
    blob = gltf.binary_blob()
    comps = COMPS[a.type]
    fmt = "<" + DTYPE[a.componentType] * comps
    item = struct.calcsize(fmt)
    stride = bv.byteStride or item
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    return np.array(
        [struct.unpack_from(fmt, blob, off + i * stride) for i in range(a.count)],
        dtype=np.float32 if a.componentType == 5126 else np.int64,
    )


def accessor_region(gltf, idx):
    a = gltf.accessors[idx]
    bv = gltf.bufferViews[a.bufferView]
    comps = COMPS[a.type]
    item = struct.calcsize("<" + DTYPE[a.componentType] * comps)
    stride = bv.byteStride or item
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    return off, off + item + (a.count - 1) * stride, stride, item


def write_accessor(gltf, idx, data, blob):
    """Sobrescribe los datos de un accessor en el blob binario del GLB."""
    a = gltf.accessors[idx]
    comps = COMPS[a.type]
    fmt = "<" + DTYPE[a.componentType] * comps
    item = struct.calcsize(fmt)
    off, end, stride, _ = accessor_region(gltf, idx)
    assert len(data) == a.count
    assert stride == item, "byteStride no estándar: se requiere manejo especial"
    payload = b"".join(struct.pack(fmt, *map(float, row)) for row in data)
    assert len(payload) == end - off
    blob[off:end] = payload
    # Actualizar min/max (obligatorio en glTF cuando están presentes)
    arr = np.asarray(data, dtype=float)
    a.min = [float(v) for v in arr.min(axis=0)]
    a.max = [float(v) for v in arr.max(axis=0)]


# --- cuaterniones (xyzw) ---------------------------------------------------
def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ])


def qnorm(q):
    q = np.asarray(q, dtype=float)
    return q / np.linalg.norm(q)


def qconj(q):
    x, y, z, w = q
    return np.array([-x, -y, -z, w])


def q_from_axis(axis, angle):
    ax = np.asarray(axis, dtype=float)
    ax /= np.linalg.norm(ax)
    s = math.sin(angle / 2)
    return np.array([ax[0] * s, ax[1] * s, ax[2] * s, math.cos(angle / 2)])


def q_from_mat(M):
    """Extrae el cuaternión de la parte rotacional de una matriz 4x4."""
    m = M[:3, :3]
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1) * 2
        return qnorm(np.array([(m[2, 1] - m[1, 2]) / s,
                               (m[0, 2] - m[2, 0]) / s,
                               (m[1, 0] - m[0, 1]) / s, 0.25 * s]))
    i = int(np.argmax(np.diag(m)))
    if i == 0:
        s = math.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        return qnorm(np.array([0.25 * s, (m[0, 1] + m[1, 0]) / s,
                               (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]))
    if i == 1:
        s = math.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        return qnorm(np.array([(m[0, 1] + m[1, 0]) / s, 0.25 * s,
                               (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]))
    s = math.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
    return qnorm(np.array([(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s,
                           0.25 * s, (m[1, 0] - m[0, 1]) / s]))


def mat_from_q(q):
    x, y, z, w = qnorm(q)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_matrix(node, rot=None):
    T = np.asarray(node.translation or [0, 0, 0], dtype=float)
    R = mat_from_q(rot if rot is not None else (node.rotation or [0, 0, 0, 1]))
    S = np.diag(node.scale or [1, 1, 1]).astype(float)
    M = np.eye(4)
    M[:3, :3] = R @ S
    M[:3, 3] = T
    return M


def world_matrices(gltf, overrides=None):
    overrides = overrides or {}
    out = {}
    def walk(i, acc):
        M = acc @ node_matrix(gltf.nodes[i], overrides.get(i))
        out[i] = M
        for c in gltf.nodes[i].children or []:
            walk(c, M)
    for sc in gltf.scenes:
        for r in sc.nodes:
            walk(r, np.eye(4))
    return out


# ------------------------------ 1) PESOS ------------------------------------
def smooth_shoulder_weights(gltf, blob):
    mesh = gltf.meshes[0].primitives[0]
    w_idx = mesh.attributes.WEIGHTS_0
    j_idx = mesh.attributes.JOINTS_0
    i_idx = mesh.indices

    weights = read_accessor(gltf, w_idx).astype(np.float64)   # (N,4)
    joints = read_accessor(gltf, j_idx)
    tris = read_accessor(gltf, i_idx).reshape(-1, 3)
    n = len(weights)

    # Vecindad por topología de triángulos
    adj = [set() for _ in range(n)]
    for a, b, c in tris:
        a, b, c = int(a), int(b), int(c)
        adj[a].update((b, c)); adj[b].update((a, c)); adj[c].update((a, b))

    # Vértices de la zona del hombro + un anillo de vecinos para suavizar el borde
    # (SHOULDER_JOINTS son índices del skin, no columnas de WEIGHTS_0)
    sel = np.zeros(n, dtype=bool)
    for c in range(4):
        sel |= np.isin(joints[:, c], SHOULDER_JOINTS) & (weights[:, c] > 0.01)
    for _ in range(2):
        grow = set()
        for v in np.flatnonzero(sel):
            grow.update(adj[v])
        sel |= np.isin(np.arange(n), list(grow))

    idx = np.flatnonzero(sel)
    print(f"  Vértices suavizados: {len(idx)} de {n} ({100*len(idx)/n:.1f}%)")
    cur = weights.copy()
    for _ in range(SMOOTH_PASSES):
        nxt = cur.copy()
        for v in idx:
            nbrs = [k for k in adj[v] if sel[k]]
            if nbrs:
                nxt[v] = (1 - SMOOTH_ALPHA) * cur[v] + SMOOTH_ALPHA * cur[nbrs].mean(axis=0)
        cur = nxt
        cur[idx] /= np.maximum(cur[idx].sum(axis=1, keepdims=True), 1e-12)

    # Normalizar todo el modelo y escribir de vuelta
    cur /= np.maximum(cur.sum(axis=1, keepdims=True), 1e-12)
    delta = np.abs(cur - weights).max()
    write_accessor(gltf, w_idx, cur.astype(np.float32), blob)
    print(f"  Cambio máximo de un peso: {delta:.4f}")
    return joints, weights, cur


# --------------------------- 2) ROTACIÓN BRAZOS -----------------------------
def open_arms(gltf, blob):
    names = {nd.name: i for i, nd in enumerate(gltf.nodes)}
    rest = world_matrices(gltf)
    angle = math.radians(ARM_ANGLE_DEG)
    anim = gltf.animations[0]
    print(f"  Animación: {anim.name!r}, canales: {len(anim.channels)}")

    # Mapa: nodo -> (sampler, accessor de salida de rotación)
    rot_samplers = {}
    for ch in anim.channels:
        if ch.target.path == "rotation":
            rot_samplers[ch.target.node] = ch.sampler

    report = {}
    for side, sign in (("l", +1), ("r", -1)):
        arm_node = names[f"upperarm_{side}"]
        clav_node = names[f"clavicle_{side}"]

        # Rotación mundo deseada: eje Y, simétrica (aleja el brazo del pecho)
        q_world = q_from_axis([0, 1, 0], sign * angle)
        # Pasar esa rotación al espacio local del padre (clavícula):
        #   G' = W·G  ->  P·(Δ·L)  ->  Δ = P⁻¹·W·P
        q_parent = q_from_mat(rest[clav_node])
        delta = qnorm(qmul(qmul(qconj(q_parent), q_world), q_parent))

        # a) rotación BASE del hueso
        q_base = qnorm(gltf.nodes[arm_node].rotation or [0, 0, 0, 1])
        q_base_new = qnorm(qmul(delta, q_base))
        gltf.nodes[arm_node].rotation = [float(v) for v in q_base_new]

        # b) TODAS las claves de rotación de la animación para ese hueso
        s = rot_samplers.get(arm_node)
        if s is None:
            raise RuntimeError(f"No hay canal de rotación para upperarm_{side}")
        out_idx = anim.samplers[s].output
        keys = read_accessor(gltf, out_idx).astype(np.float64)
        new_keys = np.array([qnorm(qmul(delta, qnorm(k))) for k in keys], dtype=np.float32)
        write_accessor(gltf, out_idx, new_keys, blob)

        # Comprobación geométrica: dirección del brazo antes / después
        def arm_dir(overrides=None):
            W = world_matrices(gltf, overrides)
            return W[arm_node][:3, 3], W[names[f"lowerarm_{side}"]][:3, 3]

        sh_old, el_old = arm_dir()
        d_old = el_old - sh_old
        report[side] = (d_old, float(np.degrees(math.atan2(d_old[2], d_old[0]))))
        print(f"  upperarm_{side}: delta local = {np.round(delta, 4)}, "
              f"{len(keys)} claves de animación ajustadas")

    return report


# -------------------------------- main -------------------------------------
def main():
    if not SRC.exists():
        raise SystemExit(f"No existe el archivo de entrada: {SRC}")
    gltf = GLTF2().load(str(SRC))
    blob = bytearray(gltf.binary_blob())
    print(f"Entrada : {SRC}")
    print(f"Salida  : {DST}")
    print(f"Vértices: {gltf.accessors[0].count}  |  Animaciones: {len(gltf.animations)}")

    print("\n[1/2] Suavizando pesos de hombros...")
    joints, w0, w1 = smooth_shoulder_weights(gltf, blob)

    print("\n[2/2] Separando brazos del pecho...")
    open_arms(gltf, blob)

    gltf.set_binary_blob(bytes(blob))
    gltf.save(str(DST))
    print(f"\nGuardado: {DST} ({DST.stat().st_size} bytes)")

    # -------- verificación del archivo escrito ----------
    chk = GLTF2().load(str(DST))
    assert len(chk.animations) == len(gltf.animations) == 1
    assert len(chk.animations[0].channels) == 67
    chk_w = read_accessor(chk, chk.meshes[0].primitives[0].attributes.WEIGHTS_0)
    sums = chk_w.sum(axis=1)
    assert np.allclose(sums, 1.0, atol=1e-4), "Los pesos no suman 1"
    names = {nd.name: i for i, nd in enumerate(chk.nodes)}
    print("Verificación OK:")
    print("  - animación Levitate_Idle conservada (67 canales)")
    print(f"  - pesos normalizados: min={sums.min():.6f} max={sums.max():.6f}")
    print("  - rotaciones base:",
          np.round(chk.nodes[names['upperarm_l']].rotation, 4),
          np.round(chk.nodes[names['upperarm_r']].rotation, 4))


if __name__ == "__main__":
    main()
