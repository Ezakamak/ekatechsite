import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Clock3,
  Database,
  Dice5,
  History,
  LockKeyhole,
  MessageCircle,
  Play,
  Send,
  ShieldCheck,
  Touchpad,
} from "lucide-react";
import { useLanguage } from "../i18n";
import {
  advanceRouletteTrajectory,
  createRouletteTrajectoryPlan,
  createRouletteTrajectoryRuntime,
  type RouletteTrajectoryFrame,
  type RouletteTrajectoryPlan,
} from "../lib/techRouletteTrajectory";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";
import { playOffSound } from "./OffSoundEngine";

type BetType =
  | "straight"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "column"
  | "dozen";

type RouletteResult = {
  id?: number;
  winning_number: number;
  winning_color: "green" | "red" | "black";
  winning_parity?: "none" | "odd" | "even";
  resolved_at?: string;
};

type RouletteLog = {
  id: number;
  round_id?: number;
  bet_type: string;
  bet_value?: string | null;
  bet_amount: number;
  winning_number: number;
  winning_color: string;
  payout_amount: number;
  profit_amount: number;
  status: string;
  created_at: string;
};

type BoardBet = {
  type: BetType;
  value?: number;
  label: string;
  multiplier: string;
};

type RouletteRound = {
  id: number;
  status: "betting" | "resolved";
  betting_started_at: number;
  spins_at: number;
  secondsLeft: number;
};

type TableBet = {
  bet_type: BetType;
  bet_value?: string | null;
  chip_count: number;
  total_amount: number;
  users?: string | null;
  user_colors?: string | null;
  primary_user_color?: string | null;
  item_labels?: string | null;
  bet_ids?: string | null;
  my_bet_ids?: string | null;
};

type PayoutHighlight = {
  won: boolean;
  multiplier: number;
  payout: number;
  profit: number;
};

type MyRouletteBet = {
  id: number;
  bet_type: BetType;
  bet_value?: string | null;
  bet_amount: number;
  stake_type?: "coin" | "item";
  stake_item_label?: string | null;
  status: string;
};

type RouletteInventoryItem = {
  id: number;
  item_name: string;
  emoji: string;
  roulette_value: number;
  status: string;
};

type RouletteChatMessage = {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar_url?: string;
  user_role?: string;
  user_level?: number;
  user_color?: string;
  message: string;
  created_at?: string;
};

const QUICK_BETS = [
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "500", value: 500 },
  { label: "1K", value: 1_000 },
  { label: "5K", value: 5_000 },
  { label: "10K", value: 10_000 },
];

const MIN_BET = 10;
const MAX_BET = 10_000;
const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const WHEEL_SECTOR_DEGREES = 360 / ROULETTE_WHEEL.length;
const WHEEL_SECTOR_RADIANS = (Math.PI * 2) / ROULETTE_WHEEL.length;
const WHEEL_ZERO_REFERENCE_DEGREES = 0;
const WHEEL_TEXTURE_ATLAS_WIDTH = 4096;
const WHEEL_TEXTURE_TILE_SIZE = 128;
const WHEEL_UV_EDGE_GUARD = 0.028;
const WHEEL_MANUAL_RADIAL_SCALE = 0.965;
const WHEEL_TEXEL_DENSITY_RINGS = 10;
const WHEEL_ANISOTROPY_TARGET = 16;
// Minimum visible spin duration. After this window the animation still continues
// frame-by-frame until the ball reaches the winning pocket; no timeout snap is used.
const SPIN_ANIMATION_SECONDS = 22;
const WHEEL_IDLE_SPIN_SECONDS = 8;
const BALL_ORBIT_TURNS = 7;
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function formatTc(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function parseBetInput(value: string) {
  return Math.floor(Number(value.replace(/[^0-9]/g, "")) || 0);
}

function numberColor(number: number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function buildWheelGradient() {
  return `conic-gradient(from 0deg, ${ROULETTE_WHEEL.map((number, index) => {
    const color =
      numberColor(number) === "green"
        ? "#16a34a"
        : numberColor(number) === "red"
          ? "#dc2626"
          : "#111827";
    const start = (index * WHEEL_SECTOR_DEGREES).toFixed(3);
    const end = ((index + 1) * WHEEL_SECTOR_DEGREES).toFixed(3);
    return `${color} ${start}deg ${end}deg`;
  }).join(", ")})`;
}

function tableBetKey(type: string, value?: number | string | null) {
  return `${type}:${value == null ? "" : value}`;
}

function describeBet(type: BetType, value?: number) {
  if (type === "straight") return `Sayı ${value}`;
  if (type === "red") return "Kırmızı";
  if (type === "black") return "Siyah";
  if (type === "odd") return "Tek";
  if (type === "even") return "Çift";
  if (type === "low") return "1-18";
  if (type === "high") return "19-36";
  if (type === "column") return `${value}. Sütun`;
  return `${value}. 12'li`;
}

function oddsMultiplierForBet(type: BetType) {
  if (type === "straight") return 35;
  if (type === "column" || type === "dozen") return 2;
  return 1;
}

function isWinningTableBet(bet: Pick<TableBet, "bet_type" | "bet_value">, winningNumber: number) {
  const value = Number(bet.bet_value);
  if (bet.bet_type === "straight") return value === winningNumber;
  if (winningNumber === 0) return false;
  if (bet.bet_type === "red") return RED_NUMBERS.has(winningNumber);
  if (bet.bet_type === "black") return !RED_NUMBERS.has(winningNumber);
  if (bet.bet_type === "odd") return winningNumber % 2 === 1;
  if (bet.bet_type === "even") return winningNumber % 2 === 0;
  if (bet.bet_type === "low") return winningNumber >= 1 && winningNumber <= 18;
  if (bet.bet_type === "high") return winningNumber >= 19 && winningNumber <= 36;
  if (bet.bet_type === "column") return ((winningNumber - 1) % 3) + 1 === value;
  if (bet.bet_type === "dozen") return Math.ceil(winningNumber / 12) === value;
  return false;
}

function buildPayoutHighlights(bets: TableBet[], winningNumber: number) {
  return bets.reduce<Record<string, PayoutHighlight>>((highlights, bet) => {
    const multiplier = oddsMultiplierForBet(bet.bet_type);
    const won = isWinningTableBet(bet, winningNumber);
    const totalAmount = Number(bet.total_amount || 0);
    highlights[tableBetKey(bet.bet_type, bet.bet_value)] = {
      won,
      multiplier,
      payout: won ? totalAmount * (multiplier + 1) : 0,
      profit: won ? totalAmount * multiplier : -totalAmount,
    };
    return highlights;
  }, {});
}

function wheelSectorCenterForNumber(winningNumber: number) {
  const wheelIndex = ROULETTE_WHEEL.indexOf(winningNumber);
  if (wheelIndex < 0) return 0;

  return wheelIndex * WHEEL_SECTOR_DEGREES + WHEEL_SECTOR_DEGREES / 2;
}

function ballOrbitEndForNumber(winningNumber: number) {
  return wheelSectorCenterForNumber(winningNumber) - 360 * BALL_ORBIT_TURNS;
}

function initialTrajectoryFrame(winningNumber = 0): RouletteTrajectoryFrame {
  return {
    angle: ballOrbitEndForNumber(winningNumber),
    radius: 1,
    progress: 0,
    done: true,
  };
}


type TechRouletteWheelWebGLProps = {
  className?: string;
  phiDegrees: number;
  uvOffset: number;
};

type RouletteWheelGlResources = {
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  texture: WebGLTexture;
  indexCount: number;
  uniforms: {
    phi: WebGLUniformLocation | null;
    uvOffset: WebGLUniformLocation | null;
    textureMap: WebGLUniformLocation | null;
  };
  attributes: {
    position: number;
    uv: number;
  };
};

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Rulet shader oluşturulamadı.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Bilinmeyen shader hatası";
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Rulet WebGL programı oluşturulamadı.");

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Bilinmeyen program hatası";
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

function rouletteColor(number: number) {
  if (number === 0) return "#16a34a";
  return RED_NUMBERS.has(number) ? "#dc2626" : "#111827";
}

function createRouletteTextureCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WHEEL_TEXTURE_ATLAS_WIDTH;
  canvas.height = WHEEL_TEXTURE_TILE_SIZE;
  const tileWidth = canvas.width / ROULETTE_WHEEL.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ROULETTE_WHEEL.forEach((number, index) => {
    const x = index * tileWidth;
    const center = x + tileWidth / 2;
    const guard = tileWidth * WHEEL_UV_EDGE_GUARD;

    ctx.fillStyle = rouletteColor(number);
    ctx.fillRect(x, 0, tileWidth, WHEEL_TEXTURE_TILE_SIZE);

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x, 0, 2, WHEEL_TEXTURE_TILE_SIZE);
    ctx.fillRect(x + tileWidth - 2, 0, 2, WHEEL_TEXTURE_TILE_SIZE);

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x + guard, guard, tileWidth - guard * 2, 8);
    ctx.fillRect(
      x + guard,
      WHEEL_TEXTURE_TILE_SIZE - guard - 8,
      tileWidth - guard * 2,
      8,
    );

    ctx.save();
    ctx.translate(center, WHEEL_TEXTURE_TILE_SIZE * 0.52);
    ctx.rotate(Math.PI / 2);
    ctx.font = "900 54px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(0,0,0,0.88)";
    ctx.strokeText(String(number), 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(number), 0, 0);
    ctx.restore();
  });

  return canvas;
}

function buildRouletteWheelMesh() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const innerRadius = 0.34;
  const outerRadius = 0.96;
  const radialSteps = WHEEL_TEXEL_DENSITY_RINGS;
  const segmentCount = ROULETTE_WHEEL.length;

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const manualUStart = (segment + WHEEL_UV_EDGE_GUARD) / segmentCount;
    const manualUEnd = (segment + 1 - WHEEL_UV_EDGE_GUARD) / segmentCount;
    const angleStart =
      segment * WHEEL_SECTOR_RADIANS +
      (WHEEL_ZERO_REFERENCE_DEGREES * Math.PI) / 180;
    const angleEnd = angleStart + WHEEL_SECTOR_RADIANS;
    const baseVertex = positions.length / 2;

    for (let radial = 0; radial <= radialSteps; radial += 1) {
      const radialT = radial / radialSteps;
      const easedRadius =
        innerRadius +
        (outerRadius - innerRadius) * Math.pow(radialT, WHEEL_MANUAL_RADIAL_SCALE);
      const v = 1 - radialT;

      [angleStart, angleEnd].forEach((angle, edge) => {
        positions.push(Math.sin(angle) * easedRadius, -Math.cos(angle) * easedRadius);
        uvs.push(edge === 0 ? manualUStart : manualUEnd, v);
      });
    }

    for (let radial = 0; radial < radialSteps; radial += 1) {
      const row = baseVertex + radial * 2;
      indices.push(row, row + 1, row + 2, row + 1, row + 3, row + 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function createRouletteWheelResources(gl: WebGLRenderingContext) {
  const program = createProgram(
    gl,
    `
      precision highp float;
      attribute vec2 a_position;
      attribute vec2 a_uv;
      uniform float u_phi;
      uniform float u_uvOffset;
      varying vec2 v_uv;

      void main() {
        float s = sin(u_phi);
        float c = cos(u_phi);
        vec2 lockedPosition = vec2(a_position.x, a_position.y);

        gl_Position = vec4(lockedPosition, 0.0, 1.0);
        v_uv = vec2(fract(a_uv.x + (u_phi / 6.28318530718) + u_uvOffset), a_uv.y);
      }
    `,
    `
      precision mediump float;
      uniform sampler2D u_textureMap;
      varying vec2 v_uv;

      void main() {
        vec4 texel = texture2D(u_textureMap, v_uv);
        gl_FragColor = texel;
      }
    `,
  );

  const mesh = buildRouletteWheelMesh();
  const positionBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!positionBuffer || !uvBuffer || !indexBuffer || !texture) {
    throw new Error("Rulet WebGL buffer/texture kaynakları oluşturulamadı.");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    createRouletteTextureCanvas(),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);

  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy) {
    const maxAnisotropy = gl.getParameter(
      anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT,
    ) as number;
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(WHEEL_ANISOTROPY_TARGET, maxAnisotropy),
    );
  }

  return {
    program,
    positionBuffer,
    uvBuffer,
    indexBuffer,
    texture,
    indexCount: mesh.indices.length,
    uniforms: {
      phi: gl.getUniformLocation(program, "u_phi"),
      uvOffset: gl.getUniformLocation(program, "u_uvOffset"),
      textureMap: gl.getUniformLocation(program, "u_textureMap"),
    },
    attributes: {
      position: gl.getAttribLocation(program, "a_position"),
      uv: gl.getAttribLocation(program, "a_uv"),
    },
  } satisfies RouletteWheelGlResources;
}

function renderRouletteWheel(
  gl: WebGLRenderingContext,
  resources: RouletteWheelGlResources,
  phiDegrees: number,
  uvOffset: number,
) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(resources.program);

  gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer);
  gl.enableVertexAttribArray(resources.attributes.position);
  gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, resources.uvBuffer);
  gl.enableVertexAttribArray(resources.attributes.uv);
  gl.vertexAttribPointer(resources.attributes.uv, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, resources.texture);
  gl.uniform1i(resources.uniforms.textureMap, 0);
  gl.uniform1f(resources.uniforms.phi, (phiDegrees * Math.PI) / 180);
  gl.uniform1f(resources.uniforms.uvOffset, uvOffset);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resources.indexBuffer);
  gl.drawElements(gl.TRIANGLES, resources.indexCount, gl.UNSIGNED_SHORT, 0);
}

function TechRouletteWheelWebGL({
  className,
  phiDegrees,
  uvOffset,
}: TechRouletteWheelWebGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourcesRef = useRef<RouletteWheelGlResources | null>(null);
  const [webGlReady, setWebGlReady] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
    });

    if (!gl) {
      setWebGlReady(false);
      return;
    }

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const size = Math.max(1, Math.floor(Math.min(width, height) * window.devicePixelRatio));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
    };

    try {
      resourcesRef.current = createRouletteWheelResources(gl);
      resize();
      renderRouletteWheel(gl, resourcesRef.current, phiDegrees, uvOffset);
      setWebGlReady(true);
    } catch (error) {
      console.error("Tech Roulette WebGL wheel initialization failed", error);
      setWebGlReady(false);
    }

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (!resourcesRef.current) return;
      gl.deleteProgram(resourcesRef.current.program);
      gl.deleteBuffer(resourcesRef.current.positionBuffer);
      gl.deleteBuffer(resourcesRef.current.uvBuffer);
      gl.deleteBuffer(resourcesRef.current.indexBuffer);
      gl.deleteTexture(resourcesRef.current.texture);
      resourcesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resources = resourcesRef.current;
    const gl = canvas?.getContext("webgl");
    if (!canvas || !gl || !resources) return;

    const { width, height } = canvas.getBoundingClientRect();
    const size = Math.max(1, Math.floor(Math.min(width, height) * window.devicePixelRatio));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    renderRouletteWheel(gl, resources, phiDegrees, uvOffset);
  }, [phiDegrees, uvOffset]);

  const fallbackStyle = useMemo<CSSProperties>(
    () => ({
      background: buildWheelGradient(),
      transform: `rotate(${phiDegrees}deg)`,
    }),
    [phiDegrees],
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`${className || ""} ${webGlReady ? "" : "hidden"}`}
      />
      {!webGlReady ? (
        <div aria-hidden="true" className={className} style={fallbackStyle} />
      ) : null}
    </>
  );
}


export function TechRoulette() {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const [betInput, setBetInput] = useState(String(100));
  const [betType, setBetType] = useState<BetType>("red");
  const [straightNumber, setStraightNumber] = useState(7);
  const [column, setColumn] = useState(1);
  const [dozen, setDozen] = useState(1);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recent, setRecent] = useState<RouletteLog[]>([]);
  const [recentNumbers, setRecentNumbers] = useState<RouletteResult[]>([]);
  const [currentRound, setCurrentRound] = useState<RouletteRound | null>(null);
  const [tableBets, setTableBets] = useState<TableBet[]>([]);
  const [myBets, setMyBets] = useState<MyRouletteBet[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pendingResult, setPendingResult] = useState<RouletteResult | null>(null);
  const [payoutHighlights, setPayoutHighlights] = useState<Record<string, PayoutHighlight>>({});
  const [payoutReveal, setPayoutReveal] = useState(false);
  const [trajectoryPlan, setTrajectoryPlan] =
    useState<RouletteTrajectoryPlan | null>(null);
  const [trajectoryFrame, setTrajectoryFrame] =
    useState<RouletteTrajectoryFrame>(() => initialTrajectoryFrame());
  const [wheelPhiDegrees, setWheelPhiDegrees] = useState(WHEEL_ZERO_REFERENCE_DEGREES);
  const animationFrameRef = useRef<number | null>(null);
  const payoutClearTimeoutRef = useRef<number | null>(null);
  const spinningRef = useRef(false);
  const lastAnimatedRoundIdRef = useRef<number | null>(null);
  const [spinSequence, setSpinSequence] = useState(0);
  const [lastAnimatedRoundId, setLastAnimatedRoundId] = useState<number | null>(
    null,
  );
  const [message, setMessage] = useState(
    "SQL ekatechwallet bakiyesi yükleniyor...",
  );
  const [inventory, setInventory] = useState<RouletteInventoryItem[]>([]);
  const [stakeMode, setStakeMode] = useState<"coin" | "item">("coin");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const selectedItem =
    inventory.find(
      (item) => item.id === selectedItemId && item.status === "available",
    ) || null;
  const betAmount =
    stakeMode === "item"
      ? Number(selectedItem?.roulette_value || 0)
      : parseBetInput(betInput);
  const wheelGradient = useMemo(buildWheelGradient, []);
  const betAmountValid =
    stakeMode === "item"
      ? !!selectedItem
      : betAmount >= MIN_BET && betAmount <= MAX_BET;
  const betChips = useMemo(() => {
    const chips: Record<string, TableBet> = {};
    tableBets.forEach((bet) => {
      chips[tableBetKey(bet.bet_type, bet.bet_value)] = bet;
    });
    return chips;
  }, [tableBets]);

  const betValue = useMemo(() => {
    if (betType === "straight") return straightNumber;
    if (betType === "column") return column;
    if (betType === "dozen") return dozen;
    return undefined;
  }, [betType, column, dozen, straightNumber]);

  const selectedBetLabel = describeBet(betType, betValue);
  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    lastAnimatedRoundIdRef.current = lastAnimatedRoundId;
  }, [lastAnimatedRoundId]);

  const bettingOpen = !spinning && !!currentRound && secondsLeft > 1;

  const selectBet = (bet: BoardBet) => {
    setBetType(bet.type);
    if (bet.type === "straight" && typeof bet.value === "number")
      setStraightNumber(bet.value);
    if (bet.type === "column" && typeof bet.value === "number")
      setColumn(bet.value);
    if (bet.type === "dozen" && typeof bet.value === "number")
      setDozen(bet.value);
    playOffSound("click");
  };

  const loadState = () => {
    fetch("/api/tech-roulette", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(data?.error || "Tech Roulette yüklenemedi.");
        return data;
      })
      .then((data) => {
        setRecent(Array.isArray(data?.recent) ? data.recent : []);
        const numbers = Array.isArray(data?.recentNumbers)
          ? data.recentNumbers
          : [];
        setRecentNumbers(numbers);
        const hasNewResolvedRound =
          data?.lastResolvedRound?.winning_number != null &&
          data.lastResolvedRound.id !== lastAnimatedRoundIdRef.current;
        const spinLocked = spinningRef.current || hasNewResolvedRound;
        if (numbers[0] && !hasNewResolvedRound && !spinLocked)
          setResult(numbers[0]);
        if (spinLocked) {
          setCurrentRound(null);
          setSecondsLeft(0);
        } else {
          setCurrentRound(data?.currentRound || null);
          setTableBets(Array.isArray(data?.tableBets) ? data.tableBets : []);
          setMyBets(Array.isArray(data?.myBets) ? data.myBets : []);
          setSecondsLeft(
            Math.max(0, Number(data?.currentRound?.secondsLeft || 0)),
          );
        }
        setInventory(Array.isArray(data?.inventory) ? data.inventory : []);
        if (hasNewResolvedRound) {
          setPendingResult(data.lastResolvedRound);
          setLastAnimatedRoundId(data.lastResolvedRound.id);
          lastAnimatedRoundIdRef.current = data.lastResolvedRound.id;
          animateWheelTo(data.lastResolvedRound);
        }
        setMessage("Çevrimiçi masa, geri sayım ve ortak çipler hazır.");
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Tech Roulette yüklenemedi.",
        ),
      );
  };

  useEffect(() => {
    loadState();
    const poll = window.setInterval(loadState, 2500);
    return () => window.clearInterval(poll);
  }, [lastAnimatedRoundId]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null)
        window.cancelAnimationFrame(animationFrameRef.current);
      if (payoutClearTimeoutRef.current != null)
        window.clearTimeout(payoutClearTimeoutRef.current);
    };
  }, []);

  const animateWheelTo = (resolvedRound: RouletteResult) => {
    if (animationFrameRef.current != null)
      window.cancelAnimationFrame(animationFrameRef.current);
    if (payoutClearTimeoutRef.current != null) {
      window.clearTimeout(payoutClearTimeoutRef.current);
      payoutClearTimeoutRef.current = null;
    }
    setPayoutReveal(false);
    setPayoutHighlights({});
    const tableBetsSnapshot = [...tableBets];
    const plan = createRouletteTrajectoryPlan(
      resolvedRound.winning_number,
      SPIN_ANIMATION_SECONDS,
    );
    const runtime = createRouletteTrajectoryRuntime(plan);
    let lastTimestamp = performance.now();

    setTrajectoryPlan(plan);
    setTrajectoryFrame({ angle: 0, radius: 1, progress: 0, done: false });
    setSpinSequence((current) => current + 1);
    spinningRef.current = true;
    setSpinning(true);
    setPendingResult(resolvedRound);
    setCurrentRound(null);
    setSecondsLeft(0);

    const tick = (timestamp: number) => {
      const deltaSeconds = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      const frame = advanceRouletteTrajectory(plan, runtime, deltaSeconds);
      const easedWheelPhi =
        (WHEEL_ZERO_REFERENCE_DEGREES +
          (360 * 5 + plan.pocketCenterAngle) * frame.progress) %
        360;
      setTrajectoryFrame(frame);
      setWheelPhiDegrees(easedWheelPhi);

      if (!frame.done) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      animationFrameRef.current = null;
      setTrajectoryFrame({ ...frame, done: true });
      spinningRef.current = false;
      setSpinning(false);
      setPendingResult(null);
      setResult(resolvedRound);
      setPayoutHighlights(
        buildPayoutHighlights(
          tableBetsSnapshot.length > 0 ? tableBetsSnapshot : tableBets,
          resolvedRound.winning_number,
        ),
      );
      setPayoutReveal(true);
      playOffSound("win");
      payoutClearTimeoutRef.current = window.setTimeout(() => {
        setPayoutReveal(false);
        setPayoutHighlights({});
        setTableBets([]);
        setMyBets([]);
        loadState();
      }, 4200);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    playOffSound("reel");
  };

  const playRound = async () => {
    if (!bettingOpen || !betAmountValid) return;
    setMessage(
      "Bahis SQL masasına yazılıyor ve tüm kullanıcılara senkronlanıyor...",
    );
    playOffSound("bet");

    try {
      const response = await fetch("/api/tech-roulette", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          stakeMode === "item"
            ? { type: betType, value: betValue, stakeItemId: selectedItemId }
            : { type: betType, value: betValue, amount: betAmount },
        ),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error || "Rulet bahsi tamamlanamadı.");

      setCurrentRound(data?.currentRound || currentRound);
      setTableBets(Array.isArray(data?.tableBets) ? data.tableBets : []);
      setMyBets(Array.isArray(data?.myBets) ? data.myBets : []);
      setSecondsLeft(
        Math.max(0, Number(data?.currentRound?.secondsLeft || secondsLeft)),
      );
      setMessage(
        `${selectedBetLabel} üzerine ${stakeMode === "item" && selectedItem ? `${selectedItem.emoji} ${selectedItem.item_name}` : `${formatTc(betAmount, locale)} TC`} koyuldu. Çipler ortak SQL masasından herkese görünür.`,
      );
      if (stakeMode === "item") setSelectedItemId(null);
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      window.setTimeout(loadState, 500);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Rulet bahsi tamamlanamadı.",
      );
      playOffSound("error");
    }
  };

  const cancelBet = async (chip?: TableBet) => {
    const hasItemStake = String(chip?.item_labels || "").trim().length > 0;
    if (hasItemStake) {
      setMessage("Racon eşyası masaya koyulduktan sonra geri kaldırılamaz; tur sonucunu bekle.");
      playOffSound("error");
      return;
    }
    const ownBetId = Number(String(chip?.my_bet_ids || "").split(",")[0] || 0);
    if (!ownBetId || !bettingOpen) return;
    setMessage("Çip geri çekiliyor ve bahis bakiyesi iade ediliyor...");
    playOffSound("click");

    try {
      const response = await fetch("/api/tech-roulette", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betId: ownBetId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error || "Bahis geri çekilemedi.");

      setTableBets(Array.isArray(data?.tableBets) ? data.tableBets : []);
      setMyBets(Array.isArray(data?.myBets) ? data.myBets : []);
      setInventory(Array.isArray(data?.inventory) ? data.inventory : []);
      setMessage("Yanlış bahis masadan kaldırıldı; çip bakiyene/eşyana iade edildi.");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bahis geri çekilemedi.");
      playOffSound("error");
    }
  };

  const visibleRecentNumbers = pendingResult
    ? recentNumbers.filter((item) => item.id !== pendingResult.id)
    : recentNumbers;
  const settledResult = pendingResult ? null : result;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050806] px-4 pb-24 pt-28 text-white sm:px-6">
      <RaconItemEffects tableBets={tableBets} active={tableBets.some((bet) => String(bet.item_labels || "").trim())} />
      <div className="absolute left-1/2 top-28 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-80 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="sticky top-20 z-30 rounded-full border border-white/10 bg-black/60 px-4 py-2 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 overflow-x-auto text-xs text-white/55">
            <span className="shrink-0 font-semibold uppercase tracking-[0.18em] text-amber-100/80">
              Son sayılar
            </span>
            {visibleRecentNumbers.length === 0 ? (
              <span>{spinning ? "Top durunca açıklanacak" : "Henüz sonuç yok"}</span>
            ) : (
              visibleRecentNumbers.map((item) => (
                <span
                  key={item.id || `${item.winning_number}-${item.resolved_at}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${item.winning_color === "green" ? "bg-emerald-500" : item.winning_color === "red" ? "bg-red-600" : "bg-zinc-950 ring-1 ring-white/20"}`}
                >
                  {item.winning_number}
                </span>
              ))
            )}
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                  <ShieldCheck className="h-4 w-4" /> Canlı
                  ekatechwallet
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
                  Tech Roulette
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                  Avrupa ruleti: Bahisler aşağıda gördüğünüz Tech Coin Cüzdanınınzdan kullanılır.
                </p>
              </div>
              <TechCoinWalletBadge />
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(18rem,27rem)_1fr]">
              <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),rgba(0,0,0,0.82)_62%)] p-5">
                <div className="absolute top-4 z-20 h-0 w-0 border-x-[13px] border-t-[24px] border-x-transparent border-t-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <div
                  className="tech-roulette-wheel relative aspect-square w-full max-w-[24rem] rounded-full border-[12px] border-amber-300 bg-zinc-950 shadow-2xl shadow-black before:absolute before:inset-[12%] before:z-10 before:rounded-full before:border before:border-white/15 before:bg-[radial-gradient(circle,#202020_0_38%,transparent_39%)] after:absolute after:inset-[43%] after:z-20 after:rounded-full after:bg-amber-100 after:shadow-[0_0_24px_rgba(251,191,36,0.8)]"
                  style={{
                    ["--wheel-spin-seconds" as string]: `${WHEEL_IDLE_SPIN_SECONDS}s`,
                    ["--wheel-uv-offset" as string]: String(
                      trajectoryPlan?.wheelUvOffset || 0,
                    ),
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="tech-roulette-wheel-face absolute inset-0 rounded-full"
                    style={{
                      animation: spinning
                        ? "none"
                        : `tech-roulette-wheel-spin ${WHEEL_IDLE_SPIN_SECONDS}s linear infinite`,
                      background: wheelGradient,
                      transform: `rotate(${wheelPhiDegrees}deg)`,
                      ["--wheel-settle-angle" as string]: `${wheelPhiDegrees}deg`,
                    }}
                  >
                    {ROULETTE_WHEEL.map((number, index) => {
                      const sectorCenter =
                        index * WHEEL_SECTOR_DEGREES + WHEEL_SECTOR_DEGREES / 2;
                      return (
                        <span
                          key={number}
                          className="tech-roulette-pocket-label absolute inset-0 flex justify-center text-[0.62rem] font-black leading-none tracking-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] sm:text-xs"
                          style={{ transform: `rotate(${sectorCenter}deg)` }}
                        >
                          <span className="mt-[6.5%] inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/25 bg-black/35 px-1 shadow-[inset_0_0_8px_rgba(255,255,255,0.12)] [transform:rotate(90deg)]">
                            {number}
                          </span>
                        </span>
                      );
                    })}
                    <div className="pointer-events-none absolute inset-[3.5%] rounded-full border-[3px] border-yellow-100/60 shadow-[inset_0_0_18px_rgba(253,224,71,0.35)]" />
                    <div className="pointer-events-none absolute inset-[22%] rounded-full border-[10px] border-amber-900/80 bg-[radial-gradient(circle,#3a210f_0_36%,#120a05_37%_60%,transparent_61%)] shadow-[inset_0_0_24px_rgba(0,0,0,0.9),0_0_18px_rgba(245,158,11,0.25)]" />
                    {settledResult ? (
                      <div
                        aria-hidden="true"
                        className="tech-roulette-settled-ball-orbit pointer-events-none absolute inset-0 z-30 rounded-full"
                        style={{
                          transform: `rotate(${wheelSectorCenterForNumber(settledResult.winning_number)}deg)`,
                        }}
                      >
                        <span
                          className="tech-roulette-settled-ball absolute left-1/2 top-1/2 h-4 w-4 rounded-full border border-white bg-white shadow-[inset_-3px_-4px_5px_rgba(0,0,0,0.35)]"
                          style={{
                            transform:
                              "translate(-50%, -50%) translateY(clamp(-8.7rem, -36vw, -6.3rem))",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute inset-[5%] z-10 rounded-full border-4 border-black/50" />
                  <div className="pointer-events-none absolute inset-[15%] z-10 rounded-full border border-white/10" />
                  {pendingResult ? (
                    <div
                      key={`orbit-${spinSequence}-${pendingResult.id || pendingResult.winning_number}`}
                      className="tech-roulette-ball-orbit pointer-events-none absolute inset-0 z-40 rounded-full"
                      style={{
                        transform: `rotate(${trajectoryFrame.angle}deg)`,
                        ["--ball-orbit-end" as string]: `${trajectoryPlan?.targetAngle ?? ballOrbitEndForNumber(pendingResult.winning_number)}deg`,
                        ["--ball-spin-seconds" as string]: `${SPIN_ANIMATION_SECONDS}s`,
                      }}
                    >
                      <span
                        className="tech-roulette-ball-runner absolute left-1/2 top-1/2 z-50 h-4 w-4 rounded-full border border-white bg-white shadow-[0_0_18px_rgba(255,255,255,1),inset_-3px_-4px_5px_rgba(0,0,0,0.35)]"
                        style={{
                          transform: `translate(-50%, -50%) translateY(clamp(-${(11.05 * trajectoryFrame.radius).toFixed(2)}rem, -${(45 * trajectoryFrame.radius).toFixed(2)}vw, -${(8.25 * trajectoryFrame.radius).toFixed(2)}rem)) scale(${(0.92 + trajectoryFrame.radius * 0.08).toFixed(3)})`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                {!pendingResult && !settledResult ? (
                  <div className="pointer-events-none absolute aspect-square w-[96%] max-w-[25rem] rounded-full">
                    <span className="tech-roulette-idle-ball absolute left-1/2 top-1/2 z-50 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white shadow-[0_0_16px_rgba(255,255,255,0.9),inset_-3px_-4px_5px_rgba(0,0,0,0.3)]" />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    icon={<Dice5 className="h-4 w-4" />}
                    label="Seçili Bahis"
                    value={
                      stakeMode === "item" && selectedItem
                        ? `${selectedItem.emoji} ${formatTc(selectedItem.roulette_value, locale)} TC`
                        : `${formatTc(betAmount, locale)} TC`
                    }
                  />
                  <StatCard
                    icon={<Database className="h-4 w-4" />}
                    label="Rulet Masası"
                    value={spinning ? "Çevriliyor" : "Hazır"}
                  />
                </div>

                <div className="rounded-[1.5rem] border border-cyan-200/20 bg-cyan-300/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-50/55">
                        {currentRound ? `Tur Sayısı #${currentRound.id}` : "Bahisler kapalı"}
                      </p>
                      <p className="mt-2 text-sm text-white/60">
                        {currentRound
                          ? "Bahis süresi sadece masa açıkken işler; sayaç bitince bahisler kapanır ve top döner."
                          : "Top kazanan cebe akarken yeni bahis sayacı başlamaz."}
                      </p>
                    </div>
                    <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border border-cyan-100/30 bg-black/30">
                      <Clock3 className="h-5 w-5 text-cyan-100" />
                      <span className="mt-1 text-center font-mono text-xl font-black text-white">
                        {bettingOpen ? `${secondsLeft}s` : spinning ? "Dönüyor" : "Bekle"}
                      </span>
                    </div>
                  </div>
                </div>

                {spinning ? (
                  <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Sonuç gizli
                    </p>
                    <p className="mt-3 text-lg font-semibold text-amber-50">
                      Top Durduğunda Sonuç Açıklanacaktır. Lütfen Bekleyiniz...
                    </p>
                    <p className="mt-2 text-sm text-white/55">
                      Biliyor muysun? Birçok enayi birey tüm parasının kırmızıya koyuyor.
                    </p>
                  </div>
                ) : result && (
                  <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Son çıkan sayı
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span
                        className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black ${result.winning_color === "green" ? "bg-emerald-500" : result.winning_color === "red" ? "bg-red-600" : "bg-zinc-950 ring-1 ring-white/20"}`}
                      >
                        {result.winning_number}
                      </span>
                      <div>
                        <p className="text-2xl font-semibold">SQL tur sonucu</p>
                        <p className="text-sm text-white/55">
                          Tüm kullanıcılar aynı round, aynı geri sayım ve aynı
                          kazanan sayıyı görür.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-sm text-white/65">
                  <LockKeyhole className="mr-2 inline h-4 w-4 text-emerald-200" />{" "}
                  {message}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-emerald-200/15 bg-[linear-gradient(135deg,rgba(8,82,45,0.72),rgba(4,33,22,0.9))] p-4 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Rulet Halısı</h2>
                <p className="mt-2 text-sm text-emerald-50/65">
                  Bahis yapmak için renkli halıdaki sayı veya dış bahis alanına
                  bas.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/40 bg-black/25 px-4 py-3 text-sm text-amber-100">
                Seçim: <strong>{selectedBetLabel}</strong>
                {myBets.length > 0 ? (
                  <span className="ml-2 text-amber-50/70">· {myBets.length} aktif çipin var</span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-emerald-950/70 p-3 shadow-inner shadow-black/40">
              <RouletteTable
                selectedType={betType}
                selectedValue={betValue}
                betChips={betChips}
                payoutHighlights={payoutReveal ? payoutHighlights : {}}
                onSelect={selectBet}
                onCancelBet={cancelBet}
              />
            </div>

            <div className="mt-5 grid gap-4 rounded-[1.6rem] border border-white/10 bg-black/25 p-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Kendi bahis miktarın (TC)
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-lg font-black text-emerald-950 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-200/20"
                  inputMode="numeric"
                  min={MIN_BET}
                  max={MAX_BET}
                  value={betInput}
                  onChange={(event) =>
                    setBetInput(event.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="100"
                />
                <span
                  className={`mt-2 block text-xs ${betAmountValid ? "text-emerald-100/60" : "text-amber-200"}`}
                >
                  Limit: {formatTc(MIN_BET, locale)} -{" "}
                  {formatTc(MAX_BET, locale)} TC
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setStakeMode("coin")}
                  className={`rounded-xl px-3 py-2 ${stakeMode === "coin" ? "bg-amber-200 text-black" : "text-white/70 hover:bg-white/10"}`}
                >
                  TC ile koy
                </button>
                <button
                  type="button"
                  onClick={() => setStakeMode("item")}
                  className={`rounded-xl px-3 py-2 ${stakeMode === "item" ? "bg-amber-200 text-black" : "text-white/70 hover:bg-white/10"}`}
                >
                  Racon eşyası
                </button>
              </div>

              {stakeMode === "item" && (
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">
                    Rulet eşyası
                  </p>
                  <div className="grid gap-2">
                    {inventory.filter((item) => item.status === "available")
                      .length === 0 ? (
                      <p className="rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-sm text-amber-100">
                        OFF Hub mağazasından tesbih, çakı veya racon eşyası al;
                        burada para yerine masaya koy.
                      </p>
                    ) : (
                      inventory
                        .filter((item) => item.status === "available")
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${selectedItemId === item.id ? "border-amber-200 bg-amber-200 text-black" : "border-white/10 bg-white/10 text-white hover:bg-white/15"}`}
                          >
                            <span>
                              <span className="mr-2 text-xl">{item.emoji}</span>
                              {item.item_name}
                            </span>
                            <strong>
                              {formatTc(item.roulette_value, locale)} TC
                            </strong>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}

              {stakeMode === "coin" && (
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">
                    Hızlı miktar
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
                    {QUICK_BETS.map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setBetInput(String(chip.value))}
                        className={`rounded-full border px-3 py-3 font-semibold transition-all ${betAmount === chip.value ? "border-amber-200 bg-amber-200 text-black shadow-lg shadow-amber-500/20" : "border-white/10 bg-white/10 text-white hover:bg-white/20"}`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!bettingOpen || !betAmountValid}
                onClick={playRound}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Play className="h-5 w-5" />{" "}
                {spinning
                  ? "Çark dönüyor..."
                  : !currentRound
                    ? "Sonraki tur bekleniyor..."
                    : secondsLeft <= 1
                      ? "Tur kapanıyor..."
                      : "Çipi Koy"}
              </button>
            </div>
          </aside>
        </section>

        <RouletteLiveChat />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex items-center gap-2 text-white/80">
            <History className="h-5 w-5" /> Son Kazanç/Kayıp listesi
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.length === 0 ? (
              <p className="text-sm text-white/45">Henüz rulet logu yok.</p>
            ) : (
              recent.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/70">
                      {log.bet_type}
                      {log.bet_value ? `:${log.bet_value}` : ""}
                    </span>
                    <span
                      className={
                        log.status === "won"
                          ? "text-emerald-200"
                          : "text-red-200"
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-white/45">
                    <span>No {log.winning_number}</span>
                    <span>{formatTc(log.profit_amount, locale)} TC</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function RouletteLiveChat() {
  const [messages, setMessages] = useState<RouletteChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/tech-roulette-chat?limit=45", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error || "Rulet sohbeti yüklenemedi.");
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rulet sohbeti yüklenemedi.",
      );
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = draft.trim();
    if (!nextMessage) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/tech-roulette-chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextMessage }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Mesaj gönderilemedi.");
      setDraft("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 3500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.62),rgba(5,8,6,0.92))] backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <MessageCircle className="h-5 w-5 text-cyan-100" /> Rulet canlı
            sohbet
          </h2>
          <p className="mt-2 text-sm text-white/50">
            Rulet Masasına Özel Çevrimiçi Sohbet, hadi ilk raconu sen koy.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Canlı
        </span>
      </div>
      {error && (
        <div className="mx-5 mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100 sm:mx-6">
          {error}
        </div>
      )}
      <div
        ref={listRef}
        className="max-h-72 space-y-3 overflow-y-auto bg-black/25 p-4 sm:p-5"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">
            Henüz rulet sohbeti yok. Masaya ilk lafı sen bırak.
          </p>
        ) : (
          messages.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/38">
                <span
                  className="inline-flex items-center gap-1 font-semibold"
                  style={{ color: item.user_color || "#a5f3fc" }}
                >
                  {item.user_name}
                  {Number(item.user_level || 1) >= 5 ? (
                    <BadgeCheck className="h-3.5 w-3.5 fill-blue-500 text-white" />
                  ) : null}
                </span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5">
                  {item.user_role || "off"}
                </span>
                <span>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/82">
                {item.message}
              </p>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={sendMessage}
        className="flex flex-col gap-3 border-t border-white/10 bg-black/35 p-4 sm:flex-row sm:p-5"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 600))}
          placeholder="Rulet masasına mesaj yaz..."
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-cyan-200/40"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {sending ? "Gönderiliyor..." : "Gönder"}
        </button>
      </form>
    </section>
  );
}

function RouletteTable({
  selectedType,
  selectedValue,
  betChips,
  payoutHighlights,
  onSelect,
  onCancelBet,
}: {
  selectedType: BetType;
  selectedValue?: number;
  betChips: Record<string, TableBet>;
  payoutHighlights: Record<string, PayoutHighlight>;
  onSelect: (bet: BoardBet) => void;
  onCancelBet: (chip?: TableBet) => void;
}) {
  const isSelected = (type: BetType, value?: number) =>
    selectedType === type && (value === undefined || selectedValue === value);
  const chipFor = (type: BetType, value?: number) =>
    betChips[tableBetKey(type, value)];
  const payoutFor = (type: BetType, value?: number) =>
    payoutHighlights[tableBetKey(type, value)];
  return (
    <div className="min-w-0 overflow-x-auto pb-2">
      <div className="min-w-[48rem] select-none">
        <div className="grid grid-cols-[4.5rem_repeat(12,minmax(3.25rem,1fr))_4.5rem] gap-1">
          <button
            type="button"
            onClick={() =>
              onSelect({
                type: "straight",
                value: 0,
                label: "0",
                multiplier: "35:1",
              })
            }
            className={`relative row-span-3 rounded-l-[1.3rem] border-2 text-2xl font-black transition-all ${isSelected("straight", 0) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-500 text-white hover:border-amber-200"}`}
          >
            0
            <ChipPile chip={chipFor("straight", 0)} payout={payoutFor("straight", 0)} onCancelBet={onCancelBet} />
          </button>
          {TABLE_ROWS.map((row, rowIndex) =>
            row
              .map((number) => (
                <NumberCell
                  key={number}
                  number={number}
                  selected={isSelected("straight", number)}
                  chip={chipFor("straight", number)}
                  payout={payoutFor("straight", number)}
                  onCancelBet={onCancelBet}
                  onClick={() =>
                    onSelect({
                      type: "straight",
                      value: number,
                      label: String(number),
                      multiplier: "35:1",
                    })
                  }
                />
              ))
              .concat(
                <button
                  key={`column-${rowIndex}`}
                  type="button"
                  onClick={() =>
                    onSelect({
                      type: "column",
                      value: 3 - rowIndex,
                      label: `${3 - rowIndex}. Sütun`,
                      multiplier: "2:1",
                    })
                  }
                  className={`relative rounded-r-xl border-2 px-2 text-sm font-black transition-all ${isSelected("column", 3 - rowIndex) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-800 text-white hover:border-amber-200"}`}
                >
                  2:1
                  <ChipPile chip={chipFor("column", 3 - rowIndex)} payout={payoutFor("column", 3 - rowIndex)} onCancelBet={onCancelBet} />
                </button>,
              ),
          )}
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(3,1fr)_4.5rem] gap-1.5">
          <div />
          {[1, 2, 3].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onSelect({
                  type: "dozen",
                  value,
                  label: `${value}. 12'li`,
                  multiplier: "2:1",
                })
              }
              className={`relative rounded-xl border-2 py-3 text-sm font-black transition-all ${isSelected("dozen", value) ? "border-amber-200 bg-amber-200 text-black" : "border-white/25 bg-emerald-700 text-white hover:border-amber-200"}`}
            >
              {value === 1 ? "1-12" : value === 2 ? "13-24" : "25-36"}
              <ChipPile chip={chipFor("dozen", value)} payout={payoutFor("dozen", value)} onCancelBet={onCancelBet} />
            </button>
          ))}
          <div />
        </div>

        <div className="mt-1.5 grid grid-cols-[4.5rem_repeat(6,1fr)_4.5rem] gap-1.5">
          <div />
          <OutsideBet
            active={isSelected("low")}
            chip={chipFor("low")}
            payout={payoutFor("low")}
            onCancelBet={onCancelBet}
            onClick={() =>
              onSelect({ type: "low", label: "1-18", multiplier: "1:1" })
            }
          >
            1-18
          </OutsideBet>
          <OutsideBet
            active={isSelected("even")}
            chip={chipFor("even")}
            payout={payoutFor("even")}
            onCancelBet={onCancelBet}
            onClick={() =>
              onSelect({ type: "even", label: "Çift", multiplier: "1:1" })
            }
          >
            ÇİFT
          </OutsideBet>
          <OutsideBet
            active={isSelected("red")}
            chip={chipFor("red")}
            payout={payoutFor("red")}
            onCancelBet={onCancelBet}
            tone="red"
            onClick={() =>
              onSelect({ type: "red", label: "Kırmızı", multiplier: "1:1" })
            }
          >
            KIRMIZI
          </OutsideBet>
          <OutsideBet
            active={isSelected("black")}
            chip={chipFor("black")}
            payout={payoutFor("black")}
            onCancelBet={onCancelBet}
            tone="black"
            onClick={() =>
              onSelect({ type: "black", label: "Siyah", multiplier: "1:1" })
            }
          >
            SİYAH
          </OutsideBet>
          <OutsideBet
            active={isSelected("odd")}
            chip={chipFor("odd")}
            payout={payoutFor("odd")}
            onCancelBet={onCancelBet}
            onClick={() =>
              onSelect({ type: "odd", label: "Tek", multiplier: "1:1" })
            }
          >
            TEK
          </OutsideBet>
          <OutsideBet
            active={isSelected("high")}
            chip={chipFor("high")}
            payout={payoutFor("high")}
            onCancelBet={onCancelBet}
            onClick={() =>
              onSelect({ type: "high", label: "19-36", multiplier: "1:1" })
            }
          >
            19-36
          </OutsideBet>
          <div />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-50/60">
          <Touchpad className="h-4 w-4" /> Mobilde halıyı yana kaydırıp tüm
          sayılara dokunabilirsin.
        </div>
      </div>
    </div>
  );
}

function NumberCell({
  number,
  selected,
  chip,
  payout,
  onCancelBet,
  onClick,
}: {
  number: number;
  selected: boolean;
  chip?: TableBet;
  payout?: PayoutHighlight;
  onCancelBet: (chip?: TableBet) => void;
  onClick: () => void;
}) {
  const color = numberColor(number);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-14 items-center justify-center rounded-lg border-2 text-lg font-black leading-none tabular-nums shadow-inner transition-all ${selected ? "border-amber-200 bg-amber-200 text-black shadow-amber-950/30" : color === "red" ? "border-white/25 bg-red-600 text-white hover:border-amber-200" : "border-white/25 bg-zinc-950 text-white hover:border-amber-200"}`}
    >
      {number}
      <ChipPile chip={chip} payout={payout} onCancelBet={onCancelBet} />
    </button>
  );
}

function OutsideBet({
  active,
  chip,
  payout,
  tone = "green",
  onCancelBet,
  onClick,
  children,
}: {
  active: boolean;
  chip?: TableBet;
  payout?: PayoutHighlight;
  tone?: "green" | "red" | "black";
  onCancelBet: (chip?: TableBet) => void;
  onClick: () => void;
  children: ReactNode;
}) {
  const base =
    tone === "red"
      ? "bg-red-600"
      : tone === "black"
        ? "bg-zinc-950"
        : "bg-emerald-700";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border-2 py-3 text-sm font-black transition-all ${active ? "border-amber-200 bg-amber-200 text-black" : `border-white/25 ${base} text-white hover:border-amber-200`}`}
    >
      {children}
      <ChipPile chip={chip} payout={payout} onCancelBet={onCancelBet} />
    </button>
  );
}

function ChipPile({
  chip,
  payout,
  onCancelBet,
}: {
  chip?: TableBet;
  payout?: PayoutHighlight;
  onCancelBet: (chip?: TableBet) => void;
}) {
  if (!chip) return null;
  const totalAmount = Number(chip.total_amount || 0);
  const itemLabels = String(chip.item_labels || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const uniqueItemLabels = [...new Set(itemLabels)];
  const canCancel = Boolean(chip.my_bet_ids) && uniqueItemLabels.length === 0 && !payout;
  const primaryItemLabel = uniqueItemLabels[0] || "";
  const [itemEmojiPart, ...itemNameParts] = primaryItemLabel.split(/\s+/);
  const primaryItemEmoji = itemEmojiPart || "💎";
  const primaryItemName = itemNameParts.join(" ").trim();

  if (uniqueItemLabels.length > 0) {
    return (
      <span
        role={canCancel ? "button" : undefined}
        tabIndex={canCancel ? 0 : undefined}
        title={`${chip.users || "Oyuncular"} · ${uniqueItemLabels.join(", ")} · ${formatTc(totalAmount, "tr-TR")} TC${canCancel ? " · Geri çekmek için bas" : uniqueItemLabels.length > 0 ? " · Racon geri kaldırılamaz" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (canCancel) onCancelBet(chip);
        }}
        onKeyDown={(event) => {
          if (!canCancel || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          event.stopPropagation();
          onCancelBet(chip);
        }}
        className={`tech-roulette-item-bet absolute -right-5 -top-6 z-30 flex min-w-[7.25rem] origin-bottom items-center gap-1.5 rounded-[1.15rem] border-2 border-amber-100/95 bg-[linear-gradient(135deg,rgba(255,247,178,0.98),rgba(251,146,60,0.95),rgba(168,85,247,0.92))] px-2.5 py-2 text-left text-[0.58rem] font-black text-black shadow-[0_0_26px_rgba(251,191,36,0.9),0_12px_28px_rgba(0,0,0,0.55)] ring-4 ring-amber-300/30 transition hover:scale-110 ${canCancel ? "cursor-pointer" : "pointer-events-none"}`}
      >
        <span className="tech-roulette-item-burst" aria-hidden="true" />
        <span className="tech-roulette-item-burst tech-roulette-item-burst-delayed" aria-hidden="true" />
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-black/85 text-xl shadow-inner shadow-amber-200/40">
          {primaryItemEmoji}
        </span>
        <span className="relative min-w-0 leading-tight">
          <span className="block max-w-[5.5rem] truncate uppercase tracking-[0.08em]">
            {primaryItemName || "Racon eşyası"}
          </span>
          <span className="block whitespace-nowrap text-[0.54rem] text-black/70">
            {formatTc(totalAmount, "tr-TR")} TC
            {uniqueItemLabels.length > 1 ? ` · +${uniqueItemLabels.length - 1}` : ""}
          </span>
        </span>
        {payout ? <PayoutBadge payout={payout} /> : null}
      </span>
    );
  }

  const assignedColors = String(
    chip.user_colors || chip.primary_user_color || "#22c55e",
  )
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
  const uniqueColors = [...new Set(assignedColors)].slice(0, 6);
  const chipBackground =
    uniqueColors.length > 1
      ? `conic-gradient(${uniqueColors
          .map((color, index) => {
            const start = Math.round((index / uniqueColors.length) * 100);
            const end = Math.round(((index + 1) / uniqueColors.length) * 100);
            return `${color} ${start}% ${end}%`;
          })
          .join(", ")})`
      : uniqueColors[0] || "#22c55e";

  return (
    <span
      role={canCancel ? "button" : undefined}
      tabIndex={canCancel ? 0 : undefined}
      title={`${chip.users || "Oyuncular"} · ${formatTc(totalAmount, "tr-TR")} TC${canCancel ? " · Geri çekmek için bas" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        if (canCancel) onCancelBet(chip);
      }}
      onKeyDown={(event) => {
        if (!canCancel || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        onCancelBet(chip);
      }}
      style={{ background: chipBackground }}
      className={`absolute -right-3 -top-3 z-20 flex min-w-16 origin-bottom items-center justify-center rounded-full border-2 border-white/80 px-2.5 py-1.5 text-[0.62rem] font-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.42)] ring-2 ring-black/30 transition hover:scale-110 ${canCancel ? "cursor-pointer animate-[chip-pop_0.72s_cubic-bezier(0.2,1.2,0.2,1)]" : "pointer-events-none animate-[chip-land_1.6s_ease-in-out_infinite]"}`}
    >
      <span className="absolute inset-1 rounded-full border border-white/45 bg-black/10" />
      <span className="relative whitespace-nowrap tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {formatTc(totalAmount, "tr-TR")} TC
      </span>
      {payout ? <PayoutBadge payout={payout} /> : null}
    </span>
  );
}

function PayoutBadge({ payout }: { payout: PayoutHighlight }) {
  return (
    <span
      className={`tech-roulette-payout-badge absolute -left-4 -top-8 z-40 rounded-full border px-2.5 py-1 text-[0.58rem] font-black shadow-2xl ${
        payout.won
          ? "border-emerald-100 bg-emerald-300 text-emerald-950 shadow-emerald-300/40"
          : "border-red-100 bg-red-500 text-white shadow-red-500/35"
      }`}
    >
      {payout.won
        ? `x${payout.multiplier + 1} · +${formatTc(payout.profit, "tr-TR")} TC`
        : "Yandı"}
    </span>
  );
}

const TIKTOK_GIFT_PATHS = [
  { sx: "-12vw", sy: "82vh", ex: "18vw", ey: "34vh", r: "-18deg" },
  { sx: "112vw", sy: "78vh", ex: "74vw", ey: "28vh", r: "20deg" },
  { sx: "8vw", sy: "108vh", ex: "44vw", ey: "18vh", r: "-26deg" },
  { sx: "92vw", sy: "106vh", ex: "55vw", ey: "22vh", r: "24deg" },
  { sx: "50vw", sy: "112vh", ex: "50vw", ey: "13vh", r: "12deg" },
  { sx: "-14vw", sy: "22vh", ex: "39vw", ey: "42vh", r: "34deg" },
  { sx: "114vw", sy: "24vh", ex: "61vw", ey: "39vh", r: "-32deg" },
  { sx: "22vw", sy: "-14vh", ex: "31vw", ey: "24vh", r: "18deg" },
  { sx: "78vw", sy: "-12vh", ex: "68vw", ey: "25vh", r: "-22deg" },
  { sx: "-10vw", sy: "54vh", ex: "26vw", ey: "58vh", r: "-10deg" },
  { sx: "110vw", sy: "55vh", ex: "73vw", ey: "57vh", r: "10deg" },
  { sx: "36vw", sy: "112vh", ex: "23vw", ey: "70vh", r: "-30deg" },
  { sx: "64vw", sy: "112vh", ex: "78vw", ey: "70vh", r: "30deg" },
  { sx: "-12vw", sy: "4vh", ex: "30vw", ey: "16vh", r: "28deg" },
  { sx: "112vw", sy: "5vh", ex: "71vw", ey: "16vh", r: "-28deg" },
  { sx: "50vw", sy: "-16vh", ex: "50vw", ey: "50vh", r: "0deg" },
];

function RaconItemEffects({
  tableBets,
  active,
}: {
  tableBets: TableBet[];
  active: boolean;
}) {
  const labels = tableBets
    .flatMap((bet) =>
      String(bet.item_labels || "")
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    )
    .slice(0, 6);
  const uniqueLabels = [...new Set(labels)];
  if (!active || uniqueLabels.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      <div className="tech-roulette-gift-stage">
        <div className="tech-roulette-gift-spotlight tech-roulette-gift-spotlight--left" />
        <div className="tech-roulette-gift-spotlight tech-roulette-gift-spotlight--right" />
        {uniqueLabels.map((label, index) => {
          const [emoji = "💎", ...nameParts] = label.split(/\s+/);
          const giftName = nameParts.join(" ") || "Raconu Koydu!";
          const tone = itemEffectForLabel(label);
          const pathOffset = (index * 5) % TIKTOK_GIFT_PATHS.length;
          return (
            <div
              key={`${label}-${index}`}
              className={`tech-roulette-gift-pack tech-roulette-gift-pack--${tone}`}
              style={
                {
                  "--pack-delay": `${index * 0.34}s`,
                  "--pack-x": `${50 + ((index % 3) - 1) * 18}vw`,
                  "--pack-y": `${44 + (index % 2) * 13}vh`,
                } as CSSProperties
              }
            >
              <div className="tech-roulette-gift-card">
                <span className="tech-roulette-gift-card-emoji">{emoji}</span>
                <span className="tech-roulette-gift-card-copy">
                  <strong>RACON HEDİYESİ</strong>
                  <small>{giftName}</small>
                </span>
              </div>
              {TIKTOK_GIFT_PATHS.slice(0, 12).map((_, burstIndex) => {
                const path = TIKTOK_GIFT_PATHS[(pathOffset + burstIndex) % TIKTOK_GIFT_PATHS.length];
                return (
                  <span
                    key={burstIndex}
                    className="tech-roulette-gift-flyer"
                    style={
                      {
                        "--gift-start-x": path.sx,
                        "--gift-start-y": path.sy,
                        "--gift-end-x": path.ex,
                        "--gift-end-y": path.ey,
                        "--gift-rotate": path.r,
                        "--gift-delay": `${index * 0.16 + burstIndex * 0.105}s`,
                        "--gift-duration": `${2.2 + (burstIndex % 4) * 0.24}s`,
                        "--gift-size": `${2.1 + (burstIndex % 5) * 0.22}rem`,
                      } as CSSProperties
                    }
                  >
                    {emoji}
                  </span>
                );
              })}
              {Array.from({ length: 10 }, (_, sparkleIndex) => (
                <i
                  key={sparkleIndex}
                  className="tech-roulette-gift-spark"
                  style={
                    {
                      "--spark-angle": `${sparkleIndex * 36 + index * 11}deg`,
                      "--spark-delay": `${index * 0.18 + sparkleIndex * 0.07}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function itemEffectForLabel(label: string) {
  const normalized = label.toLocaleLowerCase("tr-TR");
  if (/tesbih|📿|boncuk/.test(normalized)) return "orbit";
  if (/çakı|bıçak|🔪|🗡️|⚔️/.test(normalized)) return "slash";
  if (/yüzük|💍|taç|👑/.test(normalized)) return "glow";
  if (/sigara|puro|🚬|duman/.test(normalized)) return "smoke";
  let hash = 0;
  for (let index = 0; index < label.length; index += 1)
    hash = (hash + label.charCodeAt(index) * (index + 3)) % 997;
  return ["rain", "orbit", "slash", "glow", "smoke"][hash % 5];
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/35">
        {icon} {label}
      </div>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
