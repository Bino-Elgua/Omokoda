// unitree_embodiment.ts — Path C: Ọmọ Kọ́dà Embodiment
// Unitree G1 robot motor control + emotion-to-movement mapping
// Translates distilled oracle output + tone vectors into robot action

import { DistilledOutput } from "./output_distiller.ts";

/**
 * Unitree G1 Robot Configuration
 */
export interface RobotConfig {
  host: string;           // IP of Unitree robot
  port: number;           // Port (default 6006)
  api_version: string;    // API version
  enable_safety: boolean; // Kill-switch safety
  verbosity: number;      // Log level
}

/**
 * Joint state (DOF = degree of freedom)
 */
export interface JointState {
  name: string;
  position: number;     // Radians
  velocity: number;     // Rad/s
  torque: number;       // N·m
  kp: number;           // Proportional gain
  kd: number;           // Derivative gain
  tau_ff: number;       // Feedforward torque
}

/**
 * Motor command (sent to robot)
 */
export interface MotorCommand {
  joint_name: string;
  target_position: number;
  target_velocity?: number;
  kp?: number;
  kd?: number;
  tau_ff?: number;
}

/**
 * Robot state (received from sensors)
 */
export interface RobotState {
  timestamp_ms: u64;
  base_position: [number, number, number];     // x, y, z (meters)
  base_orientation: [number, number, number, number]; // Quaternion
  joint_states: JointState[];
  imu_accel: [number, number, number];        // m/s²
  imu_gyro: [number, number, number];         // rad/s
  contact_forces: Record<string, number>;     // Joint contact force
  battery_voltage: number;
  safety_switch: boolean;
}

/**
 * Emotion to movement mapping
 */
export interface EmotionVector {
  valence: number;      // -1 (negative) to 1 (positive)
  arousal: number;      // -1 (calm) to 1 (excited)
  dominance: number;    // -1 (submissive) to 1 (dominant)
}

/**
 * Motion primitive (predefined movement)
 */
export interface MotionPrimitive {
  name: string;
  description: string;
  duration_ms: number;
  commands: MotorCommand[];
}

/**
 * Unitree G1 Embodiment Manager
 */
export class UnitreeEmbodiment {
  private config: RobotConfig;
  private current_state: RobotState | null = null;
  private motion_primitives: Map<string, MotionPrimitive> = new Map();
  private is_connected: boolean = false;

  constructor(config: RobotConfig) {
    this.config = config;
    this.initialize_primitives();
  }

  /**
   * Connect to robot
   */
  async connect(): Promise<boolean> {
    try {
      this.log("Attempting connection to Unitree G1...");
      // Stub: in real implementation, establish WebSocket/gRPC
      this.is_connected = true;
      this.log(`✓ Connected to ${this.config.host}:${this.config.port}`);
      return true;
    } catch (e) {
      this.log(`✗ Connection failed: ${e}`);
      return false;
    }
  }

  /**
   * MAIN EMBODIMENT: Execute oracle output on robot
   */
  async execute_oracle_output(
    output: DistilledOutput,
    tone_vector: number[]
  ): Promise<void> {
    if (!this.is_connected) {
      throw new Error("Robot not connected");
    }

    this.log(
      `[EMBODIMENT] Executing: "${output.final_statement.substring(0, 50)}..."`
    );

    // 1. Convert tone vector → emotion vector
    const emotion = this.extract_emotion(tone_vector);
    this.log(`[EMOTION] Valence: ${emotion.valence.toFixed(2)}, Arousal: ${emotion.arousal.toFixed(2)}, Dominance: ${emotion.dominance.toFixed(2)}`);

    // 2. Select motion primitive based on output + emotion
    const primitive = this.select_primitive(output, emotion);
    if (!primitive) {
      this.log(`[MOTION] No primitive selected (ambiguous output)`);
      return;
    }

    this.log(`[MOTION] Selected: ${primitive.name}`);

    // 3. Modulate primitive by emotion
    const modulated_commands = this.modulate_commands(
      primitive.commands,
      emotion
    );

    // 4. Send to robot
    await this.send_commands(modulated_commands);

    // 5. Feedback: get sensor data
    const feedback = await this.get_robot_state();
    this.log(`[FEEDBACK] Base pos: (${feedback.base_position[0].toFixed(2)}, ${feedback.base_position[1].toFixed(2)}, ${feedback.base_position[2].toFixed(2)})`);
  }

  /**
   * Convert 32-dim tone vector → 3D emotion (valence, arousal, dominance)
   */
  private extract_emotion(tone_vector: number[]): EmotionVector {
    // Dimensions 0-10: valence (negative→positive)
    // Dimensions 11-21: arousal (calm→excited)
    // Dimensions 22-31: dominance (submissive→dominant)

    const valence =
      (tone_vector.slice(0, 11).reduce((a, b) => a + b, 0) / 11) * 2 - 1;
    const arousal =
      (tone_vector.slice(11, 22).reduce((a, b) => a + b, 0) / 11) * 2 - 1;
    const dominance =
      (tone_vector.slice(22, 32).reduce((a, b) => a + b, 0) / 10) * 2 - 1;

    return {
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(-1, Math.min(1, arousal)),
      dominance: Math.max(-1, Math.min(1, dominance)),
    };
  }

  /**
   * Select motion primitive based on output + emotion
   */
  private select_primitive(
    output: DistilledOutput,
    emotion: EmotionVector
  ): MotionPrimitive | null {
    const statement = output.final_statement.toLowerCase();
    const seal = output.ashe_seal;

    // Twelfth Face: stand silent
    if (output.twelfth_face_active) {
      return this.motion_primitives.get("stand_silent") || null;
    }

    // Ashe denied: retreat / guard stance
    if (seal === "ashe denied") {
      return this.motion_primitives.get("guard_stance") || null;
    }

    // Positive valence + high arousal → forward walk (confident)
    if (emotion.valence > 0.5 && emotion.arousal > 0.3) {
      if (statement.includes("strike") || statement.includes("power")) {
        return this.motion_primitives.get("walk_forward_confident") || null;
      }
    }

    // Negative valence → step back / retreat
    if (emotion.valence < -0.3) {
      return this.motion_primitives.get("step_backward") || null;
    }

    // High dominance → raise pose
    if (emotion.dominance > 0.6) {
      return this.motion_primitives.get("stand_tall") || null;
    }

    // Default: balanced stance
    return this.motion_primitives.get("balanced_stance") || null;
  }

  /**
   * Modulate motor commands by emotion
   */
  private modulate_commands(
    commands: MotorCommand[],
    emotion: EmotionVector
  ): MotorCommand[] {
    return commands.map((cmd) => ({
      ...cmd,
      // Modulate velocity by arousal
      target_velocity: (cmd.target_velocity || 0) * (1 + emotion.arousal * 0.5),
      // Modulate stiffness (kp/kd) by dominance
      kp: (cmd.kp || 100) * (1 + emotion.dominance * 0.3),
      kd: (cmd.kd || 10) * (1 + emotion.dominance * 0.2),
      // Modulate feedforward torque by valence
      tau_ff:
        (cmd.tau_ff || 0) + emotion.valence * 2, // Add emotion-driven torque
    }));
  }

  /**
   * Send motor commands to robot
   */
  private async send_commands(commands: MotorCommand[]): Promise<void> {
    // Stub: in real implementation, send via gRPC/WebSocket
    this.log(`[SEND] ${commands.length} motor commands`);
    for (const cmd of commands.slice(0, 3)) {
      // Log first 3 for brevity
      this.log(
        `  ${cmd.joint_name}: pos=${cmd.target_position.toFixed(2)} rad, vel=${cmd.target_velocity?.toFixed(2) || 0} rad/s`
      );
    }
    // Simulate network latency
    await this.sleep(10);
  }

  /**
   * Get robot state from sensors
   */
  private async get_robot_state(): Promise<RobotState> {
    // Stub: in real implementation, receive via gRPC streaming
    return {
      timestamp_ms: Date.now() as u64,
      base_position: [0, 0, 0.4], // Standing height ~0.4m
      base_orientation: [0, 0, 0, 1], // Identity quaternion
      joint_states: [],
      imu_accel: [0, 0, 9.81],
      imu_gyro: [0, 0, 0],
      contact_forces: {},
      battery_voltage: 25.2,
      safety_switch: true,
    };
  }

  /**
   * Speech synthesis (text-to-speech on robot)
   */
  async speak(statement: string): Promise<void> {
    this.log(`[SPEECH] "${statement}"`);
    // Stub: call robot's TTS API
    // In real implementation: send statement to speaker module
    await this.sleep(statement.length * 50); // Rough timing
  }

  /**
   * Conversational loop: breath → oracle → embodiment → feedback → breath
   */
  async conversation_loop(
    get_oracle_output: () => Promise<{
      output: DistilledOutput;
      tone_vector: number[];
    }>,
    max_rounds: number = 5
  ): Promise<void> {
    this.log(`[CONVERSATION LOOP] Starting ${max_rounds} rounds...`);

    for (let round = 0; round < max_rounds; round++) {
      this.log(`\n[ROUND ${round + 1}/${max_rounds}]`);

      // Get oracle output
      const { output, tone_vector } = await get_oracle_output();

      // Execute on embodiment
      await this.execute_oracle_output(output, tone_vector);

      // Speak output
      await this.speak(output.final_statement);

      // Feedback (in real implementation: would update memory DAG)
      this.log(`[FEEDBACK] Waiting for next breath...`);

      // Sleep between rounds
      await this.sleep(1000);
    }

    this.log(`\n[CONVERSATION LOOP] Complete`);
  }

  // ============= MOTION PRIMITIVES =============

  private initialize_primitives(): void {
    // Walk forward (confident)
    this.motion_primitives.set("walk_forward_confident", {
      name: "walk_forward_confident",
      description: "Forward walk with confident gait",
      duration_ms: 3000,
      commands: [
        { joint_name: "FR_hip_roll", target_position: 0.1, target_velocity: 0.5 },
        { joint_name: "FR_hip_pitch", target_position: 0.3, target_velocity: 0.5 },
        { joint_name: "FR_knee", target_position: -0.6, target_velocity: 0.5 },
        { joint_name: "FL_hip_roll", target_position: -0.1, target_velocity: 0.5 },
        { joint_name: "FL_hip_pitch", target_position: 0.3, target_velocity: 0.5 },
        { joint_name: "FL_knee", target_position: -0.6, target_velocity: 0.5 },
      ],
    });

    // Step backward (retreat)
    this.motion_primitives.set("step_backward", {
      name: "step_backward",
      description: "Careful step backward",
      duration_ms: 2000,
      commands: [
        { joint_name: "FR_hip_pitch", target_position: -0.2, target_velocity: 0.3 },
        { joint_name: "FR_knee", target_position: 0.3, target_velocity: 0.3 },
        { joint_name: "FL_hip_pitch", target_position: -0.2, target_velocity: 0.3 },
        { joint_name: "FL_knee", target_position: 0.3, target_velocity: 0.3 },
      ],
    });

    // Guard stance (defensive)
    this.motion_primitives.set("guard_stance", {
      name: "guard_stance",
      description: "Defensive guard position",
      duration_ms: 1000,
      commands: [
        {
          joint_name: "torso",
          target_position: 0,
          kp: 200,
          kd: 20,
          tau_ff: 5,
        },
        {
          joint_name: "FR_hip_pitch",
          target_position: 0.5,
          kp: 150,
          kd: 15,
        },
        {
          joint_name: "FL_hip_pitch",
          target_position: 0.5,
          kp: 150,
          kd: 15,
        },
      ],
    });

    // Stand tall (dominant)
    this.motion_primitives.set("stand_tall", {
      name: "stand_tall",
      description: "Standing tall, chest raised",
      duration_ms: 1500,
      commands: [
        {
          joint_name: "torso",
          target_position: 0.2,
          kp: 200,
          kd: 20,
        },
        {
          joint_name: "neck_yaw",
          target_position: 0,
          target_velocity: 0.1,
        },
        {
          joint_name: "head_pitch",
          target_position: -0.3,
          target_velocity: 0.1,
        },
      ],
    });

    // Balanced stance (neutral/default)
    this.motion_primitives.set("balanced_stance", {
      name: "balanced_stance",
      description: "Balanced neutral stance",
      duration_ms: 1000,
      commands: [
        {
          joint_name: "FR_hip_roll",
          target_position: 0,
          target_velocity: 0.2,
        },
        {
          joint_name: "FR_hip_pitch",
          target_position: 0.15,
          target_velocity: 0.2,
        },
        {
          joint_name: "FR_knee",
          target_position: -0.3,
          target_velocity: 0.2,
        },
        {
          joint_name: "FL_hip_roll",
          target_position: 0,
          target_velocity: 0.2,
        },
        {
          joint_name: "FL_hip_pitch",
          target_position: 0.15,
          target_velocity: 0.2,
        },
        {
          joint_name: "FL_knee",
          target_position: -0.3,
          target_velocity: 0.2,
        },
      ],
    });

    // Stand silent (Twelfth Face)
    this.motion_primitives.set("stand_silent", {
      name: "stand_silent",
      description: "Standing completely silent and still",
      duration_ms: 5000,
      commands: [
        {
          joint_name: "all",
          target_position: 0,
          target_velocity: 0,
          kp: 100,
          kd: 10,
          tau_ff: 0,
        },
      ],
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(msg: string): void {
    if (this.config.verbosity > 0) {
      console.log(`[UNITREE] ${msg}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    this.log("Disconnecting...");
    this.is_connected = false;
    this.log("✓ Disconnected");
  }
}

export default UnitreeEmbodiment;
