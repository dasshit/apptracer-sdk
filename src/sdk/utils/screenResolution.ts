import { Dimensions, PixelRatio } from "react-native";

type TScreenResolution = {
  screenWidth: number;
  screenHeight: number;
};

export function getScreenResolution(): TScreenResolution {
  const window = Dimensions.get("screen"); // размеры в dp (logical pixels)
  const scale = PixelRatio.get(); // плотность пикселей

  const widthPx = Math.round(window.width * scale);
  const heightPx = Math.round(window.height * scale);

  return {
    screenWidth: widthPx,
    screenHeight: heightPx,
  };
}
