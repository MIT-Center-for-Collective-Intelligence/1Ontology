import { IActivity, ILoopActivity, ACTIVITY_TYPES } from "@components/types/INode";

/**
 * Configuration for creating a new loop
 */
export interface LoopConfig {
  /** Name/label for the loop */
  name: string;
  /** Unique identifier for the loop */
  id?: string;
  /** Loop condition variables */
  variables: string[];
  /** Loop condition (key-value pairs) */
  loopCondition: Record<string, boolean>;
  /** Activities to execute inside the loop */
  subActivities?: IActivity[];
}

/**
 * Builder pattern for creating loop activities algorithmically
 */
export class LoopBuilder {
  private config: Partial<LoopConfig> = {};

  /**
   * Set the loop name/label
   */
  name(name: string): LoopBuilder {
    this.config.name = name;
    return this;
  }

  /**
   * Set the loop ID (auto-generated if not provided)
   */
  id(id: string): LoopBuilder {
    this.config.id = id;
    return this;
  }

  /**
   * Set loop condition variables
   */
  variables(variables: string[]): LoopBuilder {
    this.config.variables = variables;
    return this;
  }

  /**
   * Set the loop condition
   * @param condition Object with condition keys and boolean values
   */
  condition(condition: Record<string, boolean>): LoopBuilder {
    this.config.loopCondition = condition;
    return this;
  }

  /**
   * Add a simple condition by key
   * @param key Condition key (e.g., "i < 10")
   * @param value Boolean value for the condition
   */
  addCondition(key: string, value: boolean = true): LoopBuilder {
    if (!this.config.loopCondition) {
      this.config.loopCondition = {};
    }
    this.config.loopCondition[key] = value;
    return this;
  }

  /**
   * Add activities to execute inside the loop
   */
  activities(activities: IActivity[]): LoopBuilder {
    this.config.subActivities = activities;
    return this;
  }

  /**
   * Add a single activity to the loop
   */
  addActivity(activity: IActivity): LoopBuilder {
    if (!this.config.subActivities) {
      this.config.subActivities = [];
    }
    this.config.subActivities.push(activity);
    return this;
  }

  /**
   * Build and return the loop activity
   */
  build(): ILoopActivity {
    if (!this.config.name) {
      throw new Error("Loop name is required");
    }
    if (!this.config.variables || this.config.variables.length === 0) {
      throw new Error("Loop variables are required");
    }
    if (!this.config.loopCondition) {
      throw new Error("Loop condition is required");
    }

    return {
      name: this.config.name,
      id: this.config.id || `loop-${Date.now()}`,
      type: "loop-container" as any,
      variables: this.config.variables,
      loop_condition: this.config.loopCondition,
      sub_activities: this.config.subActivities || [],
    };
  }
}

/**
 * Utility functions for common loop patterns
 */
export class LoopPatterns {
  /**
   * Creates a for-loop style iteration
   * @param variable Loop variable name (e.g., "i")
   * @param start Start value
   * @param end End value
   * @param activities Activities to execute in loop
   */
  static forLoop(
    variable: string,
    start: number,
    end: number,
    activities: IActivity[] = []
  ): ILoopActivity {
    return new LoopBuilder()
      .name(`For ${variable} = ${start} to ${end}`)
      .variables([variable])
      .addCondition(`${variable} <= ${end}`)
      .activities(activities)
      .build();
  }

  /**
   * Creates a while-loop style iteration
   * @param condition Condition string (e.g., "count < 10")
   * @param variables Variables used in the condition
   * @param activities Activities to execute in loop
   */
  static whileLoop(
    condition: string,
    variables: string[],
    activities: IActivity[] = []
  ): ILoopActivity {
    return new LoopBuilder()
      .name(`While ${condition}`)
      .variables(variables)
      .addCondition(condition)
      .activities(activities)
      .build();
  }

  /**
   * Creates a do-while loop style iteration
   * @param condition Condition string
   * @param variables Variables used in the condition
   * @param activities Activities to execute in loop
   */
  static doWhileLoop(
    condition: string,
    variables: string[],
    activities: IActivity[] = []
  ): ILoopActivity {
    return new LoopBuilder()
      .name(`Do While ${condition}`)
      .variables(variables)
      .addCondition(condition)
      .activities(activities)
      .build();
  }

  /**
   * Creates a foreach/for-each loop
   * @param item Item variable name (e.g., "item")
   * @param collection Collection variable name (e.g., "items")
   * @param activities Activities to execute in loop
   */
  static forEach(
    item: string,
    collection: string,
    activities: IActivity[] = []
  ): ILoopActivity {
    return new LoopBuilder()
      .name(`For each ${item} in ${collection}`)
      .variables([item, collection])
      .addCondition(`${item} in ${collection}`)
      .activities(activities)
      .build();
  }
}

/**
 * Loop validation utilities
 */
export class LoopValidator {
  /**
   * Validates a loop configuration
   */
  static validateLoopConfig(config: LoopConfig): string[] {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === '') {
      errors.push("Loop name is required");
    }

    if (!config.variables || config.variables.length === 0) {
      errors.push("Loop must have at least one variable");
    }

    if (!config.loopCondition || Object.keys(config.loopCondition).length === 0) {
      errors.push("Loop condition is required");
    }

    // Check for circular dependencies in sub-activities
    if (config.subActivities) {
      const activityIds = config.subActivities.map(a => a.id);
      const duplicateIds = activityIds.filter((id, index) => activityIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`Duplicate activity IDs found: ${duplicateIds.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Checks if a loop activity is valid
   */
  static isValidLoop(activity: ILoopActivity): boolean {
    return this.validateLoopConfig({
      name: activity.name,
      id: activity.id,
      variables: activity.variables,
      loopCondition: activity.loop_condition,
      subActivities: activity.sub_activities,
    }).length === 0;
  }
}

/**
 * Loop manipulation utilities
 */
export class LoopUtils {
  /**
   * Adds an activity to an existing loop
   */
  static addActivityToLoop(loop: ILoopActivity, activity: IActivity): ILoopActivity {
    return {
      ...loop,
      sub_activities: [...(loop.sub_activities || []), activity],
    };
  }

  /**
   * Removes an activity from a loop by ID
   */
  static removeActivityFromLoop(loop: ILoopActivity, activityId: string): ILoopActivity {
    return {
      ...loop,
      sub_activities: (loop.sub_activities || []).filter(a => a.id !== activityId),
    };
  }

  /**
   * Updates loop condition
   */
  static updateLoopCondition(
    loop: ILoopActivity, 
    condition: Record<string, boolean>
  ): ILoopActivity {
    return {
      ...loop,
      loop_condition: condition,
    };
  }

  /**
   * Gets all activities nested within a loop (recursive)
   */
  static getAllNestedActivities(loop: ILoopActivity): IActivity[] {
    const activities: IActivity[] = [];
    
    function collectActivities(activityList: IActivity[]) {
      for (const activity of activityList) {
        activities.push(activity);
        if (activity.sub_activities) {
          collectActivities(activity.sub_activities);
        }
      }
    }

    if (loop.sub_activities) {
      collectActivities(loop.sub_activities);
    }

    return activities;
  }

  /**
   * Estimates loop complexity based on nesting and sub-activities
   */
  static calculateLoopComplexity(loop: ILoopActivity): number {
    let complexity = 1; // Base complexity for the loop itself
    
    if (loop.sub_activities) {
      for (const activity of loop.sub_activities) {
        if (activity.type === ACTIVITY_TYPES.LOOP) {
          // Nested loop increases complexity exponentially
          complexity += this.calculateLoopComplexity(activity as ILoopActivity) * 2;
        } else if (activity.sub_activities) {
          // Other composite activities add linear complexity
          complexity += activity.sub_activities.length;
        } else {
          // Simple activities add minimal complexity
          complexity += 0.5;
        }
      }
    }

    return Math.round(complexity * 10) / 10; // Round to 1 decimal place
  }
}