import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Check, Palette } from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  isPadColorPreset,
  normalizePadColor,
  PAD_COLOR_PRESETS,
  type PadColorPreset,
} from "../lib/pads";

const COLOR_LABELS: Record<PadColorPreset, string> = {
  blue: "Blue",
  cyan: "Cyan",
  gray: "Gray",
  green: "Green",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  red: "Red",
  teal: "Teal",
  yellow: "Yellow",
};

type ColorStyle = CSSProperties & { "--otepad-swatch-color": string };

function swatchStyle(color: string): ColorStyle {
  return { "--otepad-swatch-color": color } as ColorStyle;
}

type PadColorPickerProps = {
  padTitle: string;
  color?: string;
  onChange: (color: string | undefined) => void;
};

export function PadColorPicker({
  padTitle,
  color,
  onChange,
}: PadColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedColor = normalizePadColor(color);
  const customColor =
    normalizedColor && !isPadColorPreset(normalizedColor)
      ? normalizedColor
      : "#3b82f6";

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      label={`Color for ${padTitle}`}
      placement="below"
      alignment="start"
      width={232}
      content={
        <VStack gap={3} align="stretch">
          <VStack gap={0.5} align="stretch">
            <Text type="label">Card color</Text>
            <Text type="supporting" color="secondary">
              Choose a soft tint for this card.
            </Text>
          </VStack>
          <Grid
            columns={{ minWidth: 32, repeat: "fit" }}
            gap={2}
            width="100%"
          >
            {PAD_COLOR_PRESETS.map((preset) => {
              const label = COLOR_LABELS[preset];
              const isSelected = normalizedColor === preset;
              return (
                <IconButton
                  key={preset}
                  className="otepad-color-swatch"
                  style={swatchStyle(`var(--color-background-${preset})`)}
                  variant="ghost"
                  size="sm"
                  label={`${label} card color`}
                  tooltip={label}
                  aria-pressed={isSelected}
                  icon={
                    isSelected ? <Check size={14} aria-hidden="true" /> : <></>
                  }
                  onClick={() => {
                    onChange(preset);
                    setIsOpen(false);
                  }}
                />
              );
            })}
          </Grid>
          <HStack className="otepad-custom-color-row" gap={2} vAlign="center">
            <Text type="supporting" color="secondary">
              Custom
            </Text>
            <input
              className="otepad-custom-color-input"
              type="color"
              aria-label={`Choose a custom card color for ${padTitle}`}
              value={customColor}
              style={swatchStyle(customColor)}
              onChange={(event) =>
                onChange(normalizePadColor(event.target.value))
              }
            />
            {normalizedColor ? (
              <Button
                className="otepad-color-reset"
                variant="ghost"
                size="sm"
                label="Use theme default"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
              />
            ) : null}
          </HStack>
        </VStack>
      }
    >
      {(triggerProps) => (
        <IconButton
          {...triggerProps}
          className={`otepad-card-color-trigger${isOpen ? " is-open" : ""}`}
          variant="ghost"
          size="sm"
          label={`Choose color for ${padTitle}`}
          tooltip="Card color"
          icon={<Palette size={16} aria-hidden="true" />}
          data-colored={normalizedColor ? "true" : "false"}
          style={
            normalizedColor
              ? swatchStyle(
                  isPadColorPreset(normalizedColor)
                    ? `var(--color-background-${normalizedColor})`
                    : normalizedColor,
                )
              : undefined
          }
        />
      )}
    </Popover>
  );
}
