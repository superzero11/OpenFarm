declare module "@mapbox/mapbox-gl-draw" {
    import type { IControl } from "maplibre-gl";

    interface DrawOptions {
        displayControlsDefault?: boolean;
        controls?: {
            point?: boolean;
            line_string?: boolean;
            polygon?: boolean;
            trash?: boolean;
            combine_features?: boolean;
            uncombine_features?: boolean;
        };
        defaultMode?: string;
        styles?: any[];
    }

    class MapboxDraw implements IControl {
        constructor(options?: DrawOptions);
        onAdd(map: any): HTMLElement;
        onRemove(map: any): void;
        getDefaultPosition(): string;
        set(featureCollection: GeoJSON.FeatureCollection): string[];
        add(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Geometry): string[];
        get(id: string): GeoJSON.Feature | undefined;
        getAll(): GeoJSON.FeatureCollection;
        delete(ids: string | string[]): this;
        deleteAll(): this;
        changeMode(mode: string, options?: any): this;
        getMode(): string;
        trash(): this;
        combineFeatures(): this;
        uncombineFeatures(): this;
    }

    export = MapboxDraw;
}
