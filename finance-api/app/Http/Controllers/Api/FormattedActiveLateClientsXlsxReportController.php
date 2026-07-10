<?php

namespace App\Http\Controllers\Api;

use Symfony\Component\HttpFoundation\Response;

class FormattedActiveLateClientsXlsxReportController extends ActiveLateClientsXlsxReportController
{
    private const FIRST_INFORMATION_ROW = 2;
    private const LAST_INFORMATION_ROW = 10;
    private const MONTHS_ROW = 3;
    private const INFORMATION_LABEL_STYLE = 14;
    private const INFORMATION_TEXT_STYLE = 15;
    private const INFORMATION_NUMBER_STYLE = 16;
    private const INFORMATION_INTEGER_STYLE = 17;

    public function download(): Response
    {
        $response = parent::download();
        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return $response;
        }

        $files = $this->extractStoredZip($content);

        if (! isset($files['xl/styles.xml'], $files['xl/worksheets/sheet1.xml'])) {
            return $response;
        }

        $styles = $this->addCenteredNumberStyles($files['xl/styles.xml']);
        $files['xl/styles.xml'] = $this->addInformationRowStyles($styles);

        $sheet = $this->applyNumberStyles($files['xl/worksheets/sheet1.xml']);
        $files['xl/worksheets/sheet1.xml'] = $this->applyInformationRowStyles($sheet);

        $xlsx = $this->buildStoredZip($files);
        $response->setContent($xlsx);
        $response->headers->set('Content-Length', (string) strlen($xlsx));

        return $response;
    }

    private function addCenteredNumberStyles(string $styles): string
    {
        if (! str_contains($styles, '<numFmts')) {
            $styles = preg_replace(
                '/(<styleSheet\b[^>]*>)/',
                '$1<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>',
                $styles,
                1,
            ) ?? $styles;
        }

        return preg_replace_callback(
            '/<cellXfs count="(\d+)">(.*?)<\/cellXfs>/s',
            function (array $matches): string {
                preg_match_all('/<xf\b.*?<\/xf>/s', $matches[2], $xfs);
                $original = $xfs[0] ?? [];

                if ($original === []) {
                    return $matches[0];
                }

                $numberStyles = array_map(function (string $xf): string {
                    $xf = preg_replace('/numFmtId="\d+"/', 'numFmtId="164"', $xf, 1) ?? $xf;
                    $xf = str_replace('horizontal="right"', 'horizontal="center"', $xf);

                    return $xf;
                }, $original);

                return '<cellXfs count="' . (count($original) * 2) . '">'
                    . $matches[2]
                    . implode('', $numberStyles)
                    . '</cellXfs>';
            },
            $styles,
            1,
        ) ?? $styles;
    }

    private function addInformationRowStyles(string $styles): string
    {
        $styles = preg_replace_callback(
            '/<fills count="(\d+)">(.*?)<\/fills>/s',
            fn (array $matches): string => '<fills count="' . ((int) $matches[1] + 1) . '">'
                . $matches[2]
                . '<fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill>'
                . '</fills>',
            $styles,
            1,
        ) ?? $styles;

        return preg_replace_callback(
            '/<cellXfs count="(\d+)">(.*?)<\/cellXfs>/s',
            function (array $matches): string {
                $labelStyle = '<xf numFmtId="0" fontId="2" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
                    . '<alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/>'
                    . '</xf>';
                $textStyle = '<xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
                    . '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>'
                    . '</xf>';
                $numberStyle = '<xf numFmtId="164" fontId="0" fillId="8" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
                    . '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>'
                    . '</xf>';
                $integerStyle = '<xf numFmtId="1" fontId="0" fillId="8" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
                    . '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/>'
                    . '</xf>';

                return '<cellXfs count="' . ((int) $matches[1] + 4) . '">'
                    . $matches[2]
                    . $labelStyle
                    . $textStyle
                    . $numberStyle
                    . $integerStyle
                    . '</cellXfs>';
            },
            $styles,
            1,
        ) ?? $styles;
    }

    private function applyNumberStyles(string $sheet): string
    {
        return preg_replace_callback(
            '/<c r="([^"]+)" s="(\d+)"><v>/',
            fn (array $matches): string => '<c r="' . $matches[1] . '" s="' . ((int) $matches[2] + 7) . '"><v>',
            $sheet,
        ) ?? $sheet;
    }

    private function applyInformationRowStyles(string $sheet): string
    {
        return preg_replace_callback(
            '/<row r="(\d+)">(.*?)<\/row>/s',
            function (array $matches): string {
                $rowNumber = (int) $matches[1];

                if ($rowNumber < self::FIRST_INFORMATION_ROW || $rowNumber > self::LAST_INFORMATION_ROW) {
                    return $matches[0];
                }

                $lastCellReference = null;
                if ($rowNumber === self::MONTHS_ROW) {
                    preg_match_all('/<c r="([A-Z]+\d+)"/', $matches[2], $references);
                    $allReferences = $references[1] ?? [];
                    $lastCellReference = $allReferences !== [] ? end($allReferences) : null;
                }

                $cells = preg_replace_callback(
                    '/<c r="([A-Z]+)(\d+)" s="\d+"([^>]*)>(.*?)<\/c>/s',
                    function (array $cell) use ($rowNumber, $lastCellReference): string {
                        $column = $cell[1];
                        $reference = $column . $cell[2];
                        $attributes = $cell[3];
                        $content = $cell[4];

                        if ($rowNumber === self::MONTHS_ROW && $reference === $lastCellReference) {
                            return '<c r="' . $reference . '" s="' . self::INFORMATION_TEXT_STYLE . '" t="inlineStr">'
                                . '<is><t xml:space="preserve"></t></is></c>';
                        }

                        if ($column === 'A') {
                            $style = self::INFORMATION_LABEL_STYLE;
                        } elseif ($rowNumber === self::MONTHS_ROW && str_contains($content, '<v>')) {
                            $style = self::INFORMATION_INTEGER_STYLE;
                        } elseif (str_contains($content, '<v>')) {
                            $style = self::INFORMATION_NUMBER_STYLE;
                        } else {
                            $style = self::INFORMATION_TEXT_STYLE;
                        }

                        return '<c r="' . $reference . '" s="' . $style . '"' . $attributes . '>'
                            . $content
                            . '</c>';
                    },
                    $matches[2],
                ) ?? $matches[2];

                return '<row r="' . $rowNumber . '">' . $cells . '</row>';
            },
            $sheet,
        ) ?? $sheet;
    }

    private function extractStoredZip(string $zip): array
    {
        $files = [];
        $offset = 0;
        $length = strlen($zip);

        while ($offset + 30 <= $length) {
            $header = unpack(
                'Vsignature/vversion/vflags/vcompression/vmtime/vmdate/Vcrc/Vcompressed/Vuncompressed/vnameLength/vextraLength',
                substr($zip, $offset, 30),
            );

            if (! is_array($header) || ($header['signature'] ?? 0) !== 0x04034b50) {
                break;
            }

            $nameLength = (int) $header['nameLength'];
            $extraLength = (int) $header['extraLength'];
            $compressedSize = (int) $header['compressed'];
            $compression = (int) $header['compression'];

            if ($compression !== 0) {
                return [];
            }

            $nameOffset = $offset + 30;
            $dataOffset = $nameOffset + $nameLength + $extraLength;
            $name = substr($zip, $nameOffset, $nameLength);
            $files[$name] = substr($zip, $dataOffset, $compressedSize);
            $offset = $dataOffset + $compressedSize;
        }

        return $files;
    }

    private function buildStoredZip(array $files): string
    {
        $body = '';
        $directory = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $content) {
            $name = (string) $name;
            $content = (string) $content;
            $nameLength = strlen($name);
            $size = strlen($content);
            $crc = (int) sprintf('%u', crc32($content));
            $flags = 0x0800;

            $local = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
            ) . $name . $content;

            $directory .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ) . $name;

            $body .= $local;
            $offset += strlen($local);
            $count++;
        }

        $directoryOffset = strlen($body);
        $body .= $directory;
        $body .= pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $count,
            $count,
            strlen($directory),
            $directoryOffset,
            0,
        );

        return $body;
    }
}
